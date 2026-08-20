using AFBack.Features.Exceptions;
using Serilog;
using AFBack.Infrastructure.Extensions.ApplicationExtensions;
using AFBack.Infrastructure.Extensions.BuilderExtensions;

// Oppretter et webapplikasjon-objekt, denne variabelen igjen kan man bruke funksjoner på.
var builder = WebApplication.CreateBuilder(args);

Console.WriteLine($"ASPNETCORE_ENVIRONMENT = {builder.Environment.EnvironmentName}");

// ======= Options — valideres ved oppstart =======
builder.Services.AddOptionExtensions(builder.Configuration, builder.Environment);

// ======= Konfigurerer logging =======
builder.ConfigureLogging();


// ======= Web konfigurering =======
builder.ConfigureForwardHeaders();
builder.ConfigureCors();
builder.ConfigureControllers(builder.Environment);
builder.ConfigureSwagger();

// ======= Azure services =======
// builder.Services
//     .AddAzureKeyVault(builder.Configuration)
//     .AddAzureBlobStorage(builder.Configuration)
//     .AddAzureEmail(builder.Configuration)
//     .AddAzureSms(builder.Configuration);

// ======= UpCloud Services =======
builder.Services
    .AddS3Storage()
    .AddBrevoEmail()
    .Add46ElksSms()
    .AddHashiCorpVault();

// ======= Exception håndtering og setter opp ProblemDetails =======
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ======= Infrastruktur =======
builder.Services.AddDatabase();
builder.Services.AddCaching();
builder.Services.AddIdentityAndAuthentication();
builder.Services.AddSecurityServices();
builder.Services.AddSignalRServices();
builder.Services.AddBackgroundServices();

// ======= Service registrations =======
builder.Services.AddRepositories();
builder.Services.AddBusinessServices(builder.Environment);


// Kjører applikasjonen med alle tjenester, middleware og avhengigheter. Alle servicesene og alt vi har lagt til blir låst
// og klart til bruk. 
var app = builder.Build();


// Setter opp hele HTTP-pipelinen med middlewares. Den kobler opp middlewaren i ritkig rekkefølge. Rekkefølgen er veldig viktig
app.UseAppPipeline();
await app.MigrateDatabaseAsync();

Log.Information("Application started successfully!");
Log.Information("Swagger: {Url}", "http://localhost:5058/swagger");
app.Run();

// Gjor Program tilgjengelig for WebApplicationFactory i testprosjektet
public partial class Program { }
