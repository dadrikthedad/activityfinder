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
using System.Text.Json.Serialization;
using AFBack.Services;
using DotNetEnv;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using AFBack.Filters;
using AFBack.Hubs;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.SignalR;

// Oppretter et webapplikasjon-objekt, denne variabelen igjen kan man bruke funksjoner på.
var builder = WebApplication.CreateBuilder(args);

// Et serilog objekt som logger og skriver til konsollen og en fil på PCen. Kan logges til JSON og diverse, berdre ytelse osv.
builder.Host.UseSerilog((context, services, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .WriteTo.Console()
        .WriteTo.File("logs/myapp.log", rollingInterval: RollingInterval.Day)
        .WriteTo.Logger(lc => lc
            .Filter.ByIncludingOnly(logEvent =>
                logEvent.Properties.ContainsKey("SourceContext") &&
                logEvent.Properties["SourceContext"].ToString().Contains("UserHub"))
            .WriteTo.File("logs/notifications.log", rollingInterval: RollingInterval.Day)
        );
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


// For logging. Azure har en addon som gjør at vi kan mode og da må vi lagre det som en miljøvariabel
var appInsightsKey = Environment.GetEnvironmentVariable("APPINSIGHTS_INSTRUMENTATIONKEY");

//Betingelse for denne miljøvariabelen.
if (!string.IsNullOrEmpty(appInsightsKey))
    builder.Services.AddApplicationInsightsTelemetry(appInsightsKey);


// Denne koden gjør at API-et kan håndtere HTTP-orespørsler som GET, POST, PUT og DELETE. Nødvendig for at ASP.NET CORE skal håndtere API.
// Lagt til kontrllere 10.03
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<ValidateModelAttribute>(); // ✅ Global validering
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
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
builder.Services.AddHostedService<MaintenanceCleanupService>();
builder.Services.AddScoped<SyncService>();

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
    
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);
});


// Beskytter mot bruntforce, spam og lignende angrep ved å  begrense hvor mange forespørseler som kan bli sendt i løpet av kort tid
// Må ha inn en options som vi kan da tilpasse til vårt behov.
builder.Services.AddRateLimiter(options =>
{   
    // GlobalLimiter gjelder for alle innkommende requester, ved å bruke PartitionedRateLimitir så deler vi opp i grupper
    // og de har hver sin teller.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        // RateLimitPartition teller antall forespørseler innenfor en fast tid som vi definerer med GetFixedWindowLimiter 
        RateLimitPartition.GetFixedWindowLimiter(
            // Her definerer vi at hver Ip-adresse for sin egen teller, slik at vi teller hvem som sender request.
            // Finnes ikke IP-en så får vi unknow, svært sjeldent det skal skkje.
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            // Factory er en funkksjon som returnerer innstillinger, og her gir vi hver gruppe (altså hver IP) egne innstillinger.
            factory: _ => new FixedWindowRateLimiterOptions
            {
                // Tillater 5 requests per IP i hver tidsperiode
                PermitLimit = 50, // f.eks. 5 kall
                // Maks 5 request pr 10 sekunder
                Window = TimeSpan.FromSeconds(10),
                // Mer enn 5 requester, så havner man i kø.
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                // Ikke mer enn 2 forespørsler i kø. Totalt forespørsler pr 10 sekund som blir behandlet er da 7
                QueueLimit = 2
            }));
    // For mange forespørsler i forhold til det vi har definert så får bruker error 429
    options.RejectionStatusCode = 429; // Too Many Requests
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
// Aktivirer rate-limiteren vi har spesifisert litt over oss.
app.UseRateLimiter();
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
