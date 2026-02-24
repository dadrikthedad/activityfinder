using System.Net;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;
using Serilog;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

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
    /// Setter opp forwarded headers slik at vi får klientens ekte IP-adresse bak proxy/load balancer
    /// </summary>
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
                        if (System.Net.IPNetwork.TryParse(range, out var network))
                        {
                            options.KnownIPNetworks.Add(network);
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
        
        // Denne koden gjør at API-et kan håndtere HTTP-forespørsler som GET, POST, PUT og DELETE.
        // Nødvendig for at ASP.NET CORE skal håndtere API.
        builder.Services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
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
        builder.Services.AddSwaggerGen(options =>
        { 
            // Lager er jwtSecurityScheme
            var jwtSecurityScheme = new OpenApiSecurityScheme
            {
                // Setter det at bearer skal inneholde JWT
                BearerFormat = "JWT",
                // Egendefinert navn som vises i UI-en
                Name = "JWT Authorization",
                // Hvilken type autentiseringsmekanisme vi skal bruke, feks Http, ApiKey
                Type = SecuritySchemeType.Http,
                // Forteller hvilket scheme vi skal bruke, og JwtBearerDefaults.AuthenticationScheme = "Bearer"
                Scheme = JwtBearerDefaults.AuthenticationScheme,
                // Egendefinert beskrivelse som vises i UI-en
                Description = "Enter your JWT Access Token",
                // Vi finner tokenet i headeren
                In = ParameterLocation.Header,
                // Lager en refereanse slik at alle endepunkter med [Authorize] refe rer til samme oppsett, eller så fyller
                // det seg opp med slike oppsett pr endepunkt
            };
            
            // Inkluderer summary-tagger
            var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
            var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
            options.IncludeXmlComments(xmlPath);

            // Vi registerer oppsettet med Bearer og OpenApiSecurityScheme objeektet vårt
            options.AddSecurityDefinition(JwtBearerDefaults.AuthenticationScheme, jwtSecurityScheme);


            // Dette forteller Swagger at alle endepunkter med [Authorize]-attributen bruker JWT
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecuritySchemeReference(
                        JwtBearerDefaults.AuthenticationScheme,
                        document),
                    []
                }
            });
        });
    }
}
