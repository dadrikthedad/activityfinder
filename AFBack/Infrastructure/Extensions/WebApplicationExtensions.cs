using AFBack.Hubs;
using AFBack.Infrastructure.Middleware;

namespace AFBack.Infrastructure.Extensions;

public static class WebApplicationExtensions
{
    /// <summary>
    /// Her aktivrer vi og setter opp alt vi har tidligere lagt til i builderen etter appen har startet
    /// </summary>
    /// <param name="app"></param>
    /// <returns></returns>
    public static WebApplication UseAppPipeline(this WebApplication app)
    {
        // Må være først for å fange opp feil på Middlewaren og andre exceptions
        app.UseExceptionHandler();
        
        // Tidlig for å teste APIer
        app.UseSwagger();
        app.UseSwaggerUI();
        
        // Sikrer at vi ikke blir spoofet og at proxiene vi tillater blir sluppet igjennom
        app.UseForwardedHeaders();
        
        // Sikrer at alle som prøver å gå til http blir sendt til https.
        app.UseHttpsRedirection();
        
        // Med denne kan API-et servere statiske filer som HTML, CSS, bilder osv direkte fra wwwroot-mappen.
        app.UseStaticFiles();
        
        // UseRouting() betemmer hvilken URL som skal håndtere sine spesifikke API-metoder/kontroller. 
        app.UseRouting();
        
        //Denne linjen aktiviterer den policien vi la til tidligere med AddCors(). Den må være etter Routing men før UseAuthorization.
        app.UseCors("AllowFrontend");
        
        // sikrer at vi ikke blir spammet ned av mange requester. Setter en limit pr endepunkt. brukes med IpBanMiddleware
        app.UseMiddleware<IpBanMiddleware>(); 
        app.UseRateLimiter();
        
        // Aktiverer autentisering vi lagde i AddAuthentication
        app.UseAuthentication();
        
        // Aktiverer autorisasjon slik at et API kan kontrollere hvem som har tilgang til hva. Vi kan da bruke [Authorize]
        app.UseAuthorization();
        
        // Hører sammen med AddControllers og forteller ASp.NET CORE at Api-endepunktene finnes og skal håndteres av kontrollerne.
        app.MapControllers();
        
        // her er endepunktet for meldinger til SignalR
        app.MapHub<UserHub>("/userhub");
        
        // Hvis noen prøver å gå inn på en side som ikke eksisterer så blir de sendt tilbake til home eller index.
        app.MapFallbackToFile("index.html");

        return app;
    }
}
