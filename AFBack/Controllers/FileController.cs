
   
    
    // 🆕 Endepunkt for å bare laste opp filer (uten å sende melding)
    [HttpPost("upload-files")]
    public async Task<IActionResult> UploadFiles([FromForm] List<IFormFile> files, [FromQuery] string containerName = "attachments")
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        if (files == null || files.Count == 0)
            return BadRequest(new { message = "Ingen filer oppgitt" });

        if (files.Count > 10)
            return BadRequest(new { message = "Maksimalt 10 filer per request" });

        try
        {
            var results = new List<object>();
            
            foreach (var file in files)
            {
                var (isValid, errorMessage) = fileService.ValidateFile(file);
                if (!isValid)
                {
                    results.Add(new 
                    { 
                        fileName = file.FileName, 
                        success = false, 
                        error = errorMessage 
                    });
                    continue;
                }

                try
                {
                    var fileUrl = await fileService.UploadFileAsync(file, containerName);
                    results.Add(new 
                    { 
                        fileName = file.FileName, 
                        success = true, 
                        fileUrl = fileUrl,
                        fileType = file.ContentType
                    });
                }
                catch (Exception ex)
                {
                    Logger.LogError(ex, "Failed to upload file {FileName} for appUser {UserId}", file.FileName, userId);
                    results.Add(new 
                    { 
                        fileName = file.FileName, 
                        success = false, 
                        error = "Opplasting feilet" 
                    });
                }
            }
            
            return Ok(new { results });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to upload files for appUser {UserId}", userId);
            return StatusCode(500, new { message = "Feil ved filopplasting" });
        }
    }
    
    [ApiExplorerSettings(IgnoreApi = true)]
    [HttpPost("{reportId}/attachments")]
    public async Task<IActionResult> UploadReportAttachment(
        Guid reportId, 
        [FromForm] IFormFile file)
    {
        if (file == null)
            return BadRequest(new { message = "No file provided" });

        try
        {
            var userId = GetUserId();
            
            // Hent rapporten med eksisterende attachments
            var report = await Context.Reports
                .Include(r => r.Attachments)
                .FirstOrDefaultAsync(r => r.Id == reportId);
            
            if (report == null)
                return NotFound("Report not found");

            // OPPDATERT: Tilgangskontroll som håndterer anonymous rapporter
            if (report.SubmittedByUserId.HasValue)
            {
                // Rapport har en eier - kun eieren kan legge til attachments
                if (report.SubmittedByUserId != userId)
                    return StatusCode(403, new { message = "Access denied - you can only upload to your own reports" });
            }
            else
            {
                // Anonymous rapport - du kan ikke legge til attachments til anonymous rapporter
                return StatusCode(403, new { message = "Cannot add attachments to anonymous reports" });
            }

            // Sjekk maksimalt antall attachments per rapport (f.eks. 5)
            if (report.Attachments.Count >= 5)
                return BadRequest(new { message = "Maximum number of attachments (5) reached" });

            // Valider fil
            var (isValid, errorMessage) = fileService.ValidateFile(file);
            if (!isValid)
                return BadRequest(new { message = errorMessage });

            // Last opp fil
            var fileUrl = await fileService.UploadFileAsync(file, "report-attachments");
            
            // Opprett attachment record
            var attachment = new ReportAttachment
            {
                ReportId = reportId,
                FileUrl = fileUrl,
                FileType = file.ContentType,
                FileSize = file.Length,
                FileName = file.FileName,
                UploadedAt = DateTime.UtcNow
            };

            Context.ReportAttachments.Add(attachment);
            await Context.SaveChangesAsync();

            return Ok(new { 
                AttachmentId = attachment.Id,
                FileUrl = fileUrl,
                FileName = file.FileName,
                FileSize = file.Length,
                FileType = file.ContentType,
                UploadedAt = attachment.UploadedAt
            });
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to upload attachment for report {ReportId}", reportId);
            return StatusCode(500, new { message = "Failed to upload attachment" });
        }
    }
    
    // 🆕 Hjelpemetode for filvalidering (kan brukes av frontend)
    [HttpPost("validate-file")]
    public IActionResult ValidateFile(IFormFile file)
    {
        var (isValid, errorMessage) = fileService.ValidateFile(file);
        
        if (!isValid)
            return BadRequest(new { message = errorMessage });
        
        return Ok(new 
        { 
            message = "Fil er gyldig", 
            contentType = file.ContentType, 
            size = file.Length,
            sizeInMB = Math.Round(file.Length / (1024.0 * 1024.0), 2)
        });
    }
}
