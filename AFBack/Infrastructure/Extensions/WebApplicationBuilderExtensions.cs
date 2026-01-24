using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AFBack.Filters;
using AFBack.Infrastructure.Filters;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using IPNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

namespace AFBack.Infrastructure.Extensions;

public static class WebApplicationBuilderExtensions
{
    /// <summary>
    /// Setter opp Serilog og relaterte innstillinger
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureLogging(this WebApplicationBuilder builder)
    {
        var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");
        
        // Et serilog objekt som logger og skriver til konsollen og en fil på PCen. Kan logges til JSON og diverse, berdre ytelse osv.
        builder.Host.UseSerilog((context, configuration) =>
        {
            configuration.ReadFrom.Configuration(context.Configuration);
    
            // Kun legg til Application Insights hvis tilgjengelig
            if (!string.IsNullOrEmpty(appInsightsConnectionString))
            {
                configuration.WriteTo.ApplicationInsights(appInsightsConnectionString, TelemetryConverter.Traces);
            }
        });
        
        // Fjerner Microsoft standard logging.
        builder.Logging.ClearProviders();
    }
    
    public static void ConfigureSettings(this WebApplicationBuilder builder)
    {
        // Henter miljøvariabler fra PC hvis vi kjører derifra
        Env.Load();
        
        // Henter miljøvariabler fra Azure
        builder.Configuration.SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true).AddEnvironmentVariables();

    }
    
    
    /// <summary>
    /// Her setter vi opp forwardheaders for å hente ip,device etc
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureForwardHeaders(this WebApplicationBuilder builder)
    {
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | 
                                       ForwardedHeaders.XForwardedProto | 
                                       ForwardedHeaders.XForwardedHost;
    
            options.ForwardLimit = 2;
    
            if (builder.Environment.IsDevelopment())
            {
                // Kun localhost for utvikling
                options.KnownProxies.Add(IPAddress.IPv6Loopback);
                options.KnownProxies.Add(IPAddress.Loopback);
            }
            else
            {
                // Last faktiske proxy ranges fra konfigurasjon
                var proxyRanges = builder.Configuration.GetSection("ProxyRanges").Get<string[]>();
                if (proxyRanges != null)
                {
                    foreach (var range in proxyRanges)
                    {
                        if (IPNetwork.TryParse(range, out var network))
                        {
                            options.KnownNetworks.Add(network);
                        }
                        else
                        {
                            // Log feil i konfigurasjon
                            Console.WriteLine($"Invalid proxy range in configuration: {range}");
                        }
                    }
                }
                else if (builder.Environment.IsProduction())
                {
                    // Advarsel hvis ingen proxy ranges er konfigurert i prod
                    Console.WriteLine("WARNING: No proxy ranges configured for production!");
                }
            }
    
            options.RequireHeaderSymmetry = false;
        });
    }
    
    
    /// <summary>
    /// Legger opp Cors slik at vi kan prate med frontendene
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureCors(this WebApplicationBuilder builder)
    {
        //Her lagrer vi alle domenene som kan kobles på
        var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")?.Split(',', StringSplitOptions.TrimEntries) ?? new[] { "http://localhost:3000", "https://ambitious-ground-08ddbb803.6.azurestaticapps.net", "https://magee.no", "https://www.magee.no" };

        // Gjør at alle domene kan koble seg på frontend. Måtte legge til AllowCredentials og
        // SetIsOriginAllowedToAllowWildcardSubdomains som da tillater underdomener til nettsiden.
        // With Origins sikrer at kun de domene vi spesifiserer med variabelen allowedOrigins får tilgang.
        // AllowAnyMethod lar oss bruke Get, POST, PUT og DELETE.
        // AllowAnyHeader gjør at vi kan autorisere med JWT-Tokens og sendte JSON-data. Tillater cookies og JWT-tokens.
        builder.Services.AddCors(options => options.AddPolicy("AllowFrontend",
            policy =>
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials()
                    .SetIsOriginAllowedToAllowWildcardSubdomains();
            }));
    }
    
    /// <summary>
    ///  Setter opp kontrollerne med Json Options og validering
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureControllers(this WebApplicationBuilder builder)
    {
        // Supresser ASP.NET Core sin vanlige validering slik at vi kan bruke vårt eget filter
        builder.Services.Configure<ApiBehaviorOptions>(options =>
        {
            options.SuppressModelStateInvalidFilter = true;
        });
        
        // Denne koden gjør at API-et kan håndtere HTTP-forespørsler som GET, POST, PUT og DELETE. Nødvendig for at ASP.NET CORE skal håndtere API.
        builder.Services.AddControllers(options =>
            {
                // Global validering med custom filter
                options.Filters.Add<ValidateModelStateAttribute>(); 
            })
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });
    }
    
    /// <summary>
    ///  Setter opp våre JWTToken
    /// </summary>
    /// <param name="builder"></param>
    /// <exception cref="Exception"></exception>
    public static void ConfigureAuthentication(this WebApplicationBuilder builder)
    {
        // Henter vi Key fra miljøvariabelen og issuer og audience fra json.
        var jwtKey = Environment.GetEnvironmentVariable($"JWT_SECRET_KEY");
        if (string.IsNullOrEmpty(jwtKey))
            throw new Exception("Error: JWT_SECRET_KEY is not set in environment variables. Set it in App UserSettings.");
    
        var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") 
                        ?? throw new Exception("JWT_ISSUER is missing.");

        var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") 
                          ?? throw new Exception("JWT_AUDIENCE is missing.");


        // Denne sier til ASP.NET Core at autentisering av brukere skal skje via en JWT-Token, og Bearer betyr Bearer Token.
        builder.Services.AddAuthentication("Bearer").AddJwtBearer(options =>
        {
    
            // Denne sier hvordan vi skal validere og sjekke JWT-Token om den stemmer. Her lagrer vi parameteren som skal sjekkes mot
            options.TokenValidationParameters = new TokenValidationParameters
            {
        
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,
                ValidateAudience = true,
                ValidAudience = jwtAudience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;

                    // Dette må matche pathen du brukte i MapHub()
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/userhub"))
                    {
                        context.Token = accessToken;
                    }

                    return Task.CompletedTask;
                }
            };
        });
    }
    
    /// <summary>
    /// Setter opp Swagger
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureSwagger(this WebApplicationBuilder builder)
    {
        // Add services to the container.
        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new() { Title = "AFBack API", Version = "v1" });

            // JWT Auth
            c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Description = @"JWT Authorization header. Example: 'Bearer eyJhbGci...'",
                Name = "Authorization",
                In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
                Scheme = "Bearer"
            });

            c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement()
            {
                {
                    new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                    {
                        Reference = new Microsoft.OpenApi.Models.OpenApiReference
                        {
                            Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    new string[] { }
                }
            });
    
            c.OperationFilter<FileUploadOperationFilter>();
    
            var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
            var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
            c.IncludeXmlComments(xmlPath);
        });
    }
}
