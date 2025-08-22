namespace AFBack.DTOs.Auth;

public class VerificationMethodsDTO
{
    public string WebLink { get; set; }
    public string MobileCode { get; set; }
    public string DeepLink { get; set; }
}