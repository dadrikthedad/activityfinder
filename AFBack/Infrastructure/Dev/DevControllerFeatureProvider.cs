using System.Reflection;
using AFBack.Features.Dev.Controllers;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace AFBack.Infrastructure.Dev;

/// <summary>
/// Removes the DevController when not in development
/// </summary>
public class DevControllerFeatureProvider(bool isDevelopment) : IApplicationFeatureProvider<ControllerFeature>
{
    public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
    {
        if (!isDevelopment)
            feature.Controllers.Remove(typeof(DevController).GetTypeInfo());
    }
}
