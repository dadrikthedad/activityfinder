using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AFBack.Configurations.Options;

/// <summary>
/// Denne metoden setter innstillingene for JWT fra appsettings.
/// Kan settes manuelt inne i AddAuthentication sin AddJwtBearer i Program.cs, men ekstrahert til en egen fil
/// for ryddighet og ekstra validering. Uten denne valideringen så vil appen kræsje når den er nødt til å sjekke
/// etter token, men med valideringen så kræsjer den ved oppstart istede
/// </summary>
/// <param name="jwtSettings"></param>
public class ConfigureJwtBearerOptions(IOptions<JwtSettings> jwtSettings) : IConfigureNamedOptions<JwtBearerOptions>
{
   // Vi validerer her at seksjonene i appsettings finnes og at den har verdier
   private readonly JwtSettings _jwtSettings = jwtSettings.Value;
  
   /// <summary>
   /// Her setter vi innstillingene inne i JwtBearer
   /// </summary>
   /// <param name="name"></param>
   /// <param name="options"></param>
   public void Configure(string? name, JwtBearerOptions options)
   {
       // Brukes for å sikre at vi kan gå via http når vi tester lokalt
       options.RequireHttpsMetadata = false;
       // Vi lagrer token i requesten og kan senere hente den ut med feks HttpContext.GetTokenAsync("access_token")
       options.SaveToken = true;
      
       options.TokenValidationParameters = new TokenValidationParameters
       {
      
           // Issuer er hvem som utstedte tokenet, og det kan være feks base-URLen (feks localost eller www.koptr.net)
           // Issuer og Audience må stemme med token og backend for at det skal være en gydlig token
           ValidateIssuer = true,
           ValidIssuer = _jwtSettings.Issuer,
          
           // Audience bestemmer hvem tokenet er ment for, det kan være feks "myapi" eller URL-en det også
           ValidateAudience = true,
           ValidAudience = _jwtSettings.Audience,
          
           // Dette er signeringsnøkkelen som validerer at tokenen ikke er tuklet med. Tokenen er signert av denne nøkkelen
           // ved opprettelse. Unik for hver applikasjon og skal være lagret i en ENV
           ValidateIssuerSigningKey = true,
           IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key)),
          
           // Dette feltet sikrer at tokenet får en livstids slik vi har definert i appsettings
           ValidateLifetime = true,
           // Her setter vi hvor mye tid over satt tid hvor tokenet er gyldig
           ClockSkew = TimeSpan.FromSeconds(TokenConfig.ClockSkewSeconds),
           
           // Forteller ASP.NET Core hvilke claim-navn vi bruker i tokenet
           // siden vi har slått av den automatiske mappingen
           RoleClaimType = "role",
           NameClaimType = JwtRegisteredClaimNames.Sub
       };
       
       // Vi sender token som query parameter
       options.Events = new JwtBearerEvents
       {
           OnMessageReceived = context =>
           {
               var accessToken = context.Request.Query["access_token"];
               var path = context.HttpContext.Request.Path;

               if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/userhub"))
               {
                   context.Token = accessToken;
               }

               return Task.CompletedTask;
           }
       };
   }
  
   // En overloaded metode som vi må implimentere og brukes når vi kun har et JWT-skjema, som er mest standard
   public void Configure(JwtBearerOptions options) => Configure(null, options);
}

