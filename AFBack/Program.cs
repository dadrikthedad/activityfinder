using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using AFBack.Models;
using AFBack.Data;
using Serilog;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AFBack.Services;
using DotNetEnv;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using AFBack.Configuration;
using AFBack.Extensions;
using AFBack.Filters;
using AFBack.Hubs;
using AFBack.Interface;
using AFBack.Middleware;
using AFBack.Services.Maintenance.Tasks;
using AFBack.Services.User;
using AFBack.Utils;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using IPNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

// Oppretter et webapplikasjon-objekt, denne variabelen igjen kan man bruke funksjoner på.
var builder = WebApplication.CreateBuilder(args);

Console.WriteLine($"ASPNETCORE_ENVIRONMENT = {builder.Environment.EnvironmentName}");


// For logging. Azure har en addon som gjør at vi kan mode og da må vi lagre det som en miljøvariabel
var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");

// Et serilog objekt som logger og skriver til konsollen og en fil på PCen. Kan logges til JSON og diverse, berdre ytelse osv.
builder.Host.UseSerilog((context, services, configuration) =>
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

// Henter miljøvariabler fra PC hvis vi kjører derifra
Env.Load();

// Henter miljøvariabler fra Azure
builder.Configuration.SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true).AddEnvironmentVariables();

// Henter passordet vi har lagret ved å bruke GetEnvironmentVariable og variabel navnet, hvis den returnere null så sender vi en exception. 10.03
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? throw new Exception("DB_PASSWORD IS NOT SET."); 

// Ny connectionstring for å koble oss på Azure sin miljøvariabel som er connection stringen
var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") ??
                       builder.Configuration.GetConnectionString("DefaultConnection") ??
                       throw new Exception("Database connection string is missing.");

// Connection string til bloben, for bilder
var blobConnectionString = Environment.GetEnvironmentVariable("AZURE_BLOB_CONNECTION_STRING")
                           ?? throw new Exception("AZURE_BLOB_CONNECTION_STRING is not set.");

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

// Kobler oss opp til databasen med variabelen med connectionstring og miljøvariabelen til passord.
//Denne linjen registerer databasekoblingen i ASP.NET Core Dependency Injection systemet. Legger til ApplicationDbContext som en tjeneste slik at API-et kan bruke databasen.
// Og forteller med connectionString at denne databasen er en PostgreSQL. 10.03
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));

// Kobler oss til blob-databasen
builder.Services.AddSingleton(new BlobServiceClient(blobConnectionString));

//Her lagrer vi alle domenene som kan kobles på
var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")?.Split(',', StringSplitOptions.TrimEntries) ?? new[] { "http://localhost:3000", "https://ambitious-ground-08ddbb803.6.azurestaticapps.net", "https://magee.no", "https://www.magee.no" };

// Gjør at alle domene kan koble seg på frontend. Måtte legge til AllowCredentials og SetIsOriginAllowedToAllowWildcardSubdomains som da tillater underdomener til nettsiden.
// With Origins sikrer at kun de domene vi spesifiserer med variabelen allowedOrigins får tilgang. AllowAnyMethod lar oss bruke Get, POST, PUT og DELETE.
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




//Betingelse for denne miljøvariabelen.
if (!string.IsNullOrEmpty(appInsightsConnectionString))
    builder.Services.AddApplicationInsightsTelemetry(options =>
    {
        options.ConnectionString = appInsightsConnectionString;
    });


// Denne koden gjør at API-et kan håndtere HTTP-orespørsler som GET, POST, PUT og DELETE. Nødvendig for at ASP.NET CORE skal håndtere API.
// Lagt til kontrllere 10.03
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<ValidateModelAttribute>(); // ✅ Global validering
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });


// Henter vi Key fra miljøvariabelen og issuer og audience fra json.
var jwtKey = Environment.GetEnvironmentVariable($"JWT_SECRET_KEY");
if (string.IsNullOrEmpty(jwtKey))
    throw new Exception("Error: JWT_SECRET_KEY is not set in environment variables. Set it in App Settings.");
    
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

            // 🔥 Dette må matche pathen du brukte i MapHub()
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/userhub"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

// For signalR
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase; 
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });


// Services jeg har opprettet. Til Authentisering og Notifications og Meldinger
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddScoped<ConversationService>();
builder.Services.AddScoped<IReactionService, ReactionService>();
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();
builder.Services.AddScoped<MessageNotificationService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<SendMessageCache>();
builder.Services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
builder.Services.AddHostedService<QueuedHostedService>();
builder.Services.AddScoped<GroupNotificationService>();
builder.Services.AddScoped<BootstrapService>();
builder.Services.AddScoped<FriendService>();
builder.Services.AddScoped<UserOnlineService>();
builder.Services.AddScoped<SyncService>();
builder.Services.AddScoped<NotificationSyncService>();
builder.Services.AddScoped<SupportService>();
builder.Services.AddScoped<EmailService, EmailService>();
builder.Services.AddScoped<UserService, UserService>();
builder.Services.AddEmailRateLimit();
builder.Services.Configure<IpBanOptions>(
    builder.Configuration.GetSection("IpBan"));
builder.Services.AddSingleton<IpBanService>();
builder.Services.AddHttpClient<GeolocationService>();

// Cleanup
builder.Services.AddScoped<ICleanupTask, OnlineStatusCleanupTask>();
builder.Services.AddScoped<ICleanupTask, SyncEventsCleanupTask>();
builder.Services.AddScoped<ICleanupTask, IpBanCleanupTask>();
builder.Services.AddScoped<ICleanupTask, RefreshTokenCleanupTask>();
builder.Services.AddHostedService<MaintenanceCleanupService>();

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


// Beskytter mot bruntforce, spam og lignende angrep ved å  begrense hvor mange forespørseler som kan bli sendt i løpet av kort tid
// Må ha inn en options som vi kan da tilpasse til vårt behov.
// Forenklet rate limiter konfigurasjon
builder.Services.AddRateLimiter(options =>
{   
    // Én global limiter som håndterer alt
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        // Bruk hybrid partition key (IP + device fingerprint)
        var partitionKey = IpUtils.GetHybridPartitionKey(context);
        var isMobileApp = IpUtils.IsMobileAppRequest(context);
        var isFromSharedNetwork = IpUtils.IsFromSharedNetwork(IpUtils.GetClientIp(context));
        
        // Enkle, adaptive grenser basert på nettverkstype og app-type
        var (permitLimit, windowMinutes) = IpUtils.GetSimpleRateLimit(context.Request.Path, isMobileApp, isFromSharedNetwork);
        
        return RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(windowMinutes),
                SegmentsPerWindow = 4, // 15s segmenter for 1-minutts vindu
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = isMobileApp ? 10 : 5 // Høyere kø for mobile
            });
    });

    // Snillere rejection handling med gradert respons
    options.OnRejected = async (context, cancellationToken) =>
{
    var httpContext = context.HttpContext;
    var partitionKey = IpUtils.GetHybridPartitionKey(httpContext);
    var clientIp = IpUtils.GetClientIp(httpContext) ?? "unknown";
    var isMobileApp = IpUtils.IsMobileAppRequest(httpContext);
    var isSharedNetwork = IpUtils.IsFromSharedNetwork(clientIp);
    
    // NYTT: Hent device ID for mobile apps
    var deviceId = isMobileApp 
        ? httpContext.Request.Headers["X-Device-ID"].FirstOrDefault() 
        : null;
    
    // Sett Retry-After header for smart clients
    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
    {
        var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
        httpContext.Response.Headers["Retry-After"] = seconds.ToString();
    }
    
    // Myk "strike" teller i memory cache
    var cache = httpContext.RequestServices.GetService<IMemoryCache>();
    var logger = httpContext.RequestServices.GetService<ILogger<Program>>();
    
    if (cache != null && logger != null)
    {
        var strikeKey = $"rl-strikes:{partitionKey}";
        var strikes = cache.GetOrCreate(strikeKey, entry => 
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return 0;
        });
        
        strikes++;
        cache.Set(strikeKey, strikes, TimeSpan.FromMinutes(10));
        
        // Gradert logging og potensielt ban-rapportering
        if (strikes <= 3 || isSharedNetwork)
        {
            // Soft logging for første gangs overskridelser eller shared networks
            var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
            logger.LogInformation("Rate limit hit (strike {Strike}) - {Type} from {IP}{DeviceInfo} on {Path}", 
                strikes, isMobileApp ? "Mobile" : "Web", clientIp, deviceInfo, httpContext.Request.Path);
        }
        else if (strikes >= 5 && !isSharedNetwork)
        {
            // Kun rapporter til ban service etter gjentatte overskridelser på private networks
            var ipBanService = httpContext.RequestServices.GetService<IpBanService>();
            if (ipBanService != null)
            {
                var activityType = httpContext.Request.Path.StartsWithSegments("/api/auth") 
                    ? SuspiciousActivityTypes.LOGIN_ATTEMPT 
                    : SuspiciousActivityTypes.API_ABUSE;
                    
                var reason = $"Repeated rate limit violations (strike {strikes}) - {(isMobileApp ? "Mobile" : "Web")}";
                
                // FORBEDRET: Send device ID til ban service
                await ipBanService.ReportSuspiciousActivityAsync(
                    clientIp,
                    activityType,
                    reason,
                    httpContext.Request.Headers["User-Agent"].ToString(),
                    httpContext.Request.Path,
                    deviceId); // NYTT: Device ID parameter
            }
            
            var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
            logger.LogWarning("Repeated rate limit violations (strike {Strike}) - {Type} from {IP}{DeviceInfo} on {Path}", 
                strikes, isMobileApp ? "Mobile" : "Web", clientIp, deviceInfo, httpContext.Request.Path);
        }
        else
        {
            // Moderate logging for repeated but not severe violations
            var deviceInfo = !string.IsNullOrEmpty(deviceId) ? $" Device: {deviceId[..8]}..." : "";
            logger.LogInformation("Repeated rate limit hit (strike {Strike}) - {Type} from {IP}{DeviceInfo} on {Path}", 
                strikes, isMobileApp ? "Mobile" : "Web", clientIp, deviceInfo, httpContext.Request.Path);
        }
    }

    httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
    await httpContext.Response.WriteAsync("Too many requests. Please slow down.", cancellationToken);
};

    options.RejectionStatusCode = 429;
});


builder.Services.AddSingleton<CountryService>();
builder.Services.AddSingleton<IUserIdProvider, NameIdentifierUserIdProvider>();

// Kjører applikasjonen med alle tjenester, middleware og avhengigheter. Alle servicesene og alt vi har lagt til blir låst
// og klart til bruk. 
var app = builder.Build();

// Middleware:
//Denne linjen aktiviterer den policien vi la til tidligere med AddCors(). Den må være etter Routing men før UseAuthorization.
app.UseCors("AllowFrontend");
// UseRouting() betemmer hvilken URL som skal håndtere sine spesifikke API-metoder/kontroller. 
app.UseRouting();
// Aktiverer autentisering vi lagde i AddAuthentication
app.UseAuthentication();
// Sikrer at alle som prøver å gå til http blir sendt til https.
app.UseHttpsRedirection();
// Aktiverer autorisasjon slik at et API kan kontrollere hvem som har tilgang til hva. Vi kan da bruke [Authorize]
app.UseAuthorization();
app.UseForwardedHeaders();
app.UseRateLimiter();
app.UseMiddleware<RateLimitIpBanMiddleware>(); // Legg til etter UseRateLimiter()
// Hører sammen med AddControllers og forteller ASp.NET CORE at Api-endepunktene finnes og skal håndteres av kontrollerne.
app.MapControllers();
// Med denne kan API-et servere statiske filer som HTML, CSS, bilder osv direkte fra wwwroot-mappen.
app.UseStaticFiles();
// Hvis noen prøver å gå inn på en side som ikke eksisterer så blir de sendt tilbake til home eller index.
app.MapFallbackToFile("index.html");

// her er endepunktet for meldinger til SignalR
app.MapHub<UserHub>("/userhub");




// Configure the HTTP request pipeline.
try
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
catch (Exception ex)
{
    Console.WriteLine("Swagger setup failed: " + ex.Message);
    Console.WriteLine(ex.StackTrace);
}

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

Log.Information("Application started successfully!");
app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
