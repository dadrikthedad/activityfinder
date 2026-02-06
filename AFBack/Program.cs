using Serilog;
using AFBack.Infrastructure.Extensions;
using AFBack.Infrastructure.Extensions.ApplicationExtensions;
using AFBack.Infrastructure.Extensions.BuilderExtensions;
using AFBack.Infrastructure.Extensions.ServiceExtensions;

// Oppretter et webapplikasjon-objekt, denne variabelen igjen kan man bruke funksjoner på.
var builder = WebApplication.CreateBuilder(args);

Console.WriteLine($"ASPNETCORE_ENVIRONMENT = {builder.Environment.EnvironmentName}");
// 1. Logging først for å logge feil
builder.ConfigureLogging();
// 2. UserSettings siden det brukes av alt
builder.ConfigureSettings();
// 3. Web konfigurasjon
builder.ConfigureForwardHeaders();
builder.ConfigureCors();
builder.ConfigureControllers();
builder.ConfigureSwagger();

// 4. Services i riktig rekkefølge
builder.Services.AddCoreInfrastructure(builder.Configuration);
builder.Services.AddIdentityAndAuthentication();
builder.Services.AddSignalRServices();
builder.Services.AddSecurityServices(builder.Configuration);
builder.Services.AddBackgroundServices();
builder.Services.AddRepositories();
builder.Services.AddBusinessServices();


// Kjører applikasjonen med alle tjenester, middleware og avhengigheter. Alle servicesene og alt vi har lagt til blir låst
// og klart til bruk. 
var app = builder.Build();

// Setter opp hele HTTP-pipelinen med middlewares. Den kobler opp middlewaren i ritkig rekkefølge. Rekkefølgen er veldig viktig
app.UseAppPipeline();

Log.Information("Application started successfully!");
app.Run();
