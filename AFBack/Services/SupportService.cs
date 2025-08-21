using System.Text.Json;
using AFBack.Constants;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class SupportService
    {
        private readonly ApplicationDbContext _context;
        
        public SupportService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> CreateReportAsync(ReportRequestDTO request, int? submittedByUserId)
        {
            var report = new Report
            {
                Id = Guid.NewGuid(),
                Type = request.Type,
                Title = request.Title,
                Description = request.Description,
                SubmittedByUserId = submittedByUserId, // Kan være null for anonymous
                SubmittedAt = DateTime.UtcNow,
                ReportedUserId = request.ReportedUserId,
                StepsToReproduce = request.StepsToReproduce,
                ExpectedBehavior = request.ExpectedBehavior,
                ActualBehavior = request.ActualBehavior,
                UserAgent = request.UserAgent,
                BrowserVersion = request.BrowserVersion,
                DeviceInfo = request.DeviceInfo,
                Priority = request.Priority,
                Status = ReportStatusEnum.Open,
                AttachmentsJson = request.Attachments != null && request.Attachments.Any() 
                    ? JsonSerializer.Serialize(request.Attachments) 
                    : null
            };

            _context.Reports.Add(report);
            await _context.SaveChangesAsync();

            return report.Id;
        }

        public async Task<ReportResponseDTO?> GetReportAsync(Guid reportId, int? currentUserId)
        {
            var report = await _context.Reports
                .FirstOrDefaultAsync(r => r.Id == reportId);

            if (report == null)
                return null;

            // Kun admin eller den som opprettet rapporten kan se den
            // (Du kan justere denne logikken basert på dine behov)
            if (report.SubmittedByUserId != null && 
                currentUserId != report.SubmittedByUserId && 
                !IsAdmin(currentUserId)) // Implementer IsAdmin logikk
            {
                return null;
            }

            return MapToResponseDTO(report);
        }

        public async Task<List<ReportResponseDTO>> GetUserReportsAsync(int userId)
        {
            var reports = await _context.Reports
                .Where(r => r.SubmittedByUserId == userId)
                .OrderByDescending(r => r.SubmittedAt)
                .ToListAsync();

            return reports.Select(MapToResponseDTO).ToList();
        }

        public async Task<List<ReportResponseDTO>> GetAllReportsAsync(int page = 1, int pageSize = 20)
        {
            // For admin bruk
            var reports = await _context.Reports
                .OrderByDescending(r => r.SubmittedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return reports.Select(MapToResponseDTO).ToList();
        }

        public async Task<bool> UpdateReportStatusAsync(Guid reportId, ReportStatusEnum status, string? resolution = null, string? assignedTo = null)
        {
            // For admin bruk
            var report = await _context.Reports.FindAsync(reportId);
            if (report == null)
                return false;

            report.Status = status;
            report.UpdatedAt = DateTime.UtcNow;
            
            if (!string.IsNullOrEmpty(resolution))
                report.Resolution = resolution;
                
            if (!string.IsNullOrEmpty(assignedTo))
                report.AssignedTo = assignedTo;

            await _context.SaveChangesAsync();
            return true;
        }

        private bool IsAdmin(int? userId)
        {
            // TODO: Implementer admin check logikk
            // Kan sjekke bruker rolle i database eller claims
            return false;
        }

        private ReportResponseDTO MapToResponseDTO(Report report)
        {
            return new ReportResponseDTO
            {
                Id = report.Id,
                Type = report.Type,
                Title = report.Title,
                Description = report.Description,
                SubmittedAt = report.SubmittedAt,
                Status = report.Status,
                Priority = report.Priority,
                ReportedUserId = report.ReportedUserId,
                StepsToReproduce = report.StepsToReproduce,
                ExpectedBehavior = report.ExpectedBehavior,
                ActualBehavior = report.ActualBehavior,
                UserAgent = report.UserAgent,
                BrowserVersion = report.BrowserVersion,
                DeviceInfo = report.DeviceInfo,
                UpdatedAt = report.UpdatedAt,
                AssignedTo = report.AssignedTo,
                Resolution = report.Resolution,
                Attachments = !string.IsNullOrEmpty(report.AttachmentsJson) 
                    ? JsonSerializer.Deserialize<List<string>>(report.AttachmentsJson) 
                    : null
            };
        }
    }