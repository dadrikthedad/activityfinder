namespace AFBack.Filters;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Reflection;

public class FileUploadOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var fileParameters = context.MethodInfo.GetParameters()
            .Where(p => p.ParameterType == typeof(IFormFile) || 
                        p.ParameterType == typeof(IFormFile[]) ||
                        p.ParameterType == typeof(List<IFormFile>))
            .ToList();

        if (!fileParameters.Any()) 
            return;

        // Opprett multipart/form-data schema
        var properties = new Dictionary<string, OpenApiSchema>();
        
        foreach (var param in fileParameters)
        {
            properties[param.Name!] = new OpenApiSchema
            {
                Type = "string",
                Format = "binary"
            };
        }

        operation.RequestBody = new OpenApiRequestBody
        {
            Content = new Dictionary<string, OpenApiMediaType>
            {
                ["multipart/form-data"] = new OpenApiMediaType
                {
                    Schema = new OpenApiSchema
                    {
                        Type = "object",
                        Properties = properties
                    }
                }
            }
        };

        // Fjern file-parameterne fra vanlige parametere (de håndteres i RequestBody)
        if (operation.Parameters != null)
        {
            var parametersToRemove = operation.Parameters
                .Where(p => fileParameters.Any(fp => fp.Name == p.Name))
                .ToList();
                
            foreach (var param in parametersToRemove)
            {
                operation.Parameters.Remove(param);
            }
        }
    }
}