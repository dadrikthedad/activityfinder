using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using AFBack.Models;
using AFBack.Data;
using Serilog;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using AFBack.Services;

// Oppretter et webapplikasjon-objekt, denne variabelen igjen kan man bruke funksjoner på.
var builder = WebApplication.CreateBuilder(args);

// Et serilog objekkt som logger og skriver til konsollen og en fil på PCen. Kan logges til JSON og diverse, berdre ytelse osv.
builder.Host.UseSerilog((context, services, configuration) => configuration.ReadFrom
    .Configuration(context.Configuration).WriteTo.Console().WriteTo
    .File("logs/myapp.log", rollingInterval: RollingInterval.Day));

// Fjerner Microsoft standard logging.
builder.Logging.ClearProviders();

// Henter passordet vi har lagret ved å bruke GetEnvironmentVariable og variabel navnet, hvis den returnere null så sender vi en exception. 10.03
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? throw new Exception("DB_PASSWORD IS NOT SET."); 
//Koble oss opp mot Databasen. Vi lagrer en variabel med navn ConnectionString som da blir DefaultConnection-stringen i appsettings.json
// vi bytter ut env_password med passordet vi har laget i dbPassword. 10.03
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    .Replace("{ENV_PASSWORD}", dbPassword);

//Denne linjen registerer databasekoblingen i ASP.NET Core Dependency Injection systemet. Legger til ApplicationDbContext som en tjeneste slik at API-et kan bruke databasen.
// Og forteller med connectionString at denne databasen er en PostgreSQL. 10.03
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));

// CORS-konfigurasjon, lagt inn 07.03
// Cross-Origin Resource Sharing som gjør at frontend kan kommunisere med BackEnd. Gir tiltattelse til React for å gjøre API-kall til backend.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.WithOrigins("http://localhost:3000").AllowAnyMethod().AllowAnyHeader());
});

// Denne koden gjør at API-et kan håndtere HTTP-orespørsler som GET, POST, PUT og DELETE. Nødvendig for at ASP.NET CORE skal håndtere API.
// Lagt til kontrllere 10.03
builder.Services.AddControllers();

// Henter vi Key fra miljøvariabelen og issuer og audience fra json.
var jwtKey = Environment.GetEnvironmentVariable($"JWT_SECRET_KEY") ??
             throw new Exception("JWT Key is missing in environment variables.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new Exception("JWT Issuer is missing in configuration.");
var jwtAudience = builder.Configuration["Jwt:Audience"] ??
                  throw new Exception("JWT Audience is missing in configuration.");

// Denne sier til ASP.NET Core at autentisering av brukere skal skje via en JWT-Token, og Bearer betyr Bearer Token.
builder.Services.AddAuthentication("Bearer").AddJwtBearer(options =>
{
    
    // Denne sier hvordan vi skal validere og sjekke JWT-Token om den stemmer. Her lagrer vi parameteren som skal sjekkes mot
    options.TokenValidationParameters = new TokenValidationParameters
    {
        
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Convert.FromBase64String(jwtKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddScoped<AuthService>();

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Kjører applikasjonen med alle tjenester, middleware og avhengigheter. Alle servicesene og alt vi har lagt til blir låst
// og klart til bruk. 
var app = builder.Build();

// UseRouting() betemmer hvilken URL som skal håndtere sine spesifikke API-metoder/kontroller. 
app.UseRouting();

// Aktiverer autentisering vi lagde i AddAuthentication
app.UseAuthentication();

//Denne linjen aktiviterer den policien vi la til tidligere med AddCors(). Den må være etter Routing men før UseAuthorization.
app.UseCors("AllowReactApp");
// Sikrer at alle som prøver å gå til http blir sendt til https.
app.UseHttpsRedirection();


// Aktiverer autorisasjon slik at et API kan kontrollere hvem som har tilgang til hva. Vi kan da bruke [Authorize]
app.UseAuthorization();
// Hører sammen med AddControllers og forteller ASp.NET CORE at Api-endepunktene finnes og skal håndteres av kontrollerne.
app.MapControllers();


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Med denne kan API-et servere statiske filer som HTML, CSS, bilder osv direkte fra wwwroot-mappen.
app.UseStaticFiles();
// Hvis noen prøver å gå inn på en side som ikke eksisterer så blir de sendt tilbake til home eller index.
app.MapFallbackToFile("index.html");

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
