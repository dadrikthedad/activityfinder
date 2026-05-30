using System.Net;
using System.Reflection;
using System.Text.Json.Serialization;
using AFBack.Configurations.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Serilog;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class WebApplicationBuilderExtensions
{
   
    
    /// <summary>
    /// Setter opp Serilog
    /// </summary>
    public static void ConfigureLogging(this WebApplicationBuilder builder)
    {
        // Fjerner Microsoft standard logging.
        builder.Logging.ClearProviders();
        
        // Setter opp Serilog med kun Console-logging
        builder.Host.UseSerilog((context, config) =>
        {
            config.ReadFrom.Configuration(context.Configuration);
            config.WriteTo.Console();
        });
    }
    
    
    /// <summary>
    /// Setter opp forwarded headers slik at vi får klientens ekte IP-adresse bak proxy/load balancer
    /// </summary>
    public static void ConfigureForwardHeaders(this WebApplicationBuilder builder)
    {
        var logger = builder.Services.BuildServiceProvider().GetRequiredService<ILogger<Program>>();
    
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            // Godta X-Forwarded-For (klientens IP) og X-Forwarded-Proto (HTTPS-deteksjon) Headers
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | 
                                       ForwardedHeaders.XForwardedProto;
            
            // Maks 2 proxy-hopp — hindrer at angripere injiserer falske IP-er i headeren
            options.ForwardLimit = 2;

            if (builder.Environment.IsDevelopment())
            {
                // Lokalt er localhost den eneste "proxyen"
                options.KnownProxies.Add(IPAddress.IPv6Loopback);
                options.KnownProxies.Add(IPAddress.Loopback);
            }
            else
            {
                // I produksjon godtar vi kun forwarded headers fra kjente proxy-ranges
                // Uten dette kan hvem som helst spoofe X-Forwarded-For og omgå IP-banning
                var proxyOptions = builder.Services.BuildServiceProvider()
                    .GetRequiredService<IOptions<ProxyOptions>>().Value;

                foreach (var range in proxyOptions.Ranges)
                {
                    if (System.Net.IPNetwork.TryParse(range, out var network))
                    {
                        options.KnownIPNetworks.Add(network);
                    }
                    else
                    {
                        logger.LogError("Invalid proxy range in configuration: {Range}", range);
                    }
                }

                if (!proxyOptions.Ranges.Any() && builder.Environment.IsProduction())
                {
                    logger.LogCritical("No proxy ranges configured for production!");
                }
            }
            
            // Azure setter ikke alltid like mange verdier i For/Proto-headerne
            // Uten dette avvises legitime requests fra Azure infrastruktur
            options.RequireHeaderSymmetry = false;
        });
    }
    
    
    /// <summary>
    /// Legger opp Cors slik at vi kan prate med frontend
    /// </summary>
    public static void ConfigureCors(this WebApplicationBuilder builder)
    {
        var corsOptions = builder.Services.BuildServiceProvider()
            .GetRequiredService<IOptions<CorsOptions>>().Value;

        builder.Services.AddCors(options => options.AddPolicy("AllowFrontend", policy =>
        {
            policy.WithOrigins(corsOptions.AllowedOrigins.ToArray())
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials()
                .SetIsOriginAllowedToAllowWildcardSubdomains();
        }));
    }
    
    /// <summary>
    ///  Setter opp kontrollerne med Json Options og validering
    /// </summary>
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
                // Gjør at vi kan ha Enums som både int og string
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });
    }
    
    
    /// <summary>
    /// Setter opp Swagger
    /// </summary>
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
