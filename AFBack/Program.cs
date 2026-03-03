using AFBack.Features.Exceptions;
using Serilog;
using AFBack.Infrastructure.Extensions.ApplicationExtensions;
using AFBack.Infrastructure.Extensions.BuilderExtensions;

// Oppretter et webapplikasjon-objekt, denne variabelen igjen kan man bruke funksjoner på.
var builder = WebApplication.CreateBuilder(args);

Console.WriteLine($"ASPNETCORE_ENVIRONMENT = {builder.Environment.EnvironmentName}");
// ======= Secrets først =======
builder.ConfigureSecrets(); 

// ======= Konfigurerer logging =======
builder.ConfigureLogging();

// ======= Setter opp App Insight med Serilog =======
builder.ConfigureAzureMonitoring();

// ======= Web konfigurering =======
builder.ConfigureForwardHeaders();
builder.ConfigureCors();
builder.ConfigureControllers();
builder.ConfigureSwagger();

// ======= Azure services =======
builder.Services
    .AddAzureKeyVault(builder.Configuration)
    .AddAzureBlobStorage(builder.Configuration)
    .AddAzureEmail(builder.Configuration)
    .AddAzureSms(builder.Configuration);

// ======= Exception håndtering og setter opp ProblemDetails =======
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ======= Infrastruktur =======
builder.Services.AddDatabase(builder.Configuration);
builder.Services.AddCaching(builder.Configuration);
builder.Services.AddIdentityAndAuthentication();
builder.Services.AddSecurityServices(builder.Configuration);
builder.Services.AddSignalRServices();
builder.Services.AddSecurityServices(builder.Configuration);
builder.Services.AddBackgroundServices();

// ======= Service registrations =======
builder.Services.AddRepositories();
builder.Services.AddBusinessServices();


// Kjører applikasjonen med alle tjenester, middleware og avhengigheter. Alle servicesene og alt vi har lagt til blir låst
// og klart til bruk. 
var app = builder.Build();


// Setter opp hele HTTP-pipelinen med middlewares. Den kobler opp middlewaren i ritkig rekkefølge. Rekkefølgen er veldig viktig
app.UseAppPipeline();

Log.Information("Application started successfully!");
app.Run();
