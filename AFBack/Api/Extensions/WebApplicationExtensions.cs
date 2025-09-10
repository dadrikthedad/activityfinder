namespace AFBack.Api.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication UseAppPipeline(this WebApplication app)
    {
        app.UseForwardedHeaders();

        return app;
    }
}