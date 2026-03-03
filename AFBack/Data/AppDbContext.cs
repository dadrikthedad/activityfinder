using AFBack.Features.Auth.Models;
using AFBack.Features.Blocking.Models;
using AFBack.Features.CanSend.Models;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Friendship.Models;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.MessageNotifications.Models;
using AFBack.Features.Messaging.Models;
using AFBack.Features.Notifications.Models;
using AFBack.Features.Profile.Models;
using AFBack.Features.Reactions.Models;
using AFBack.Features.Settings.Models;
using AFBack.Features.SignalR.Models;
using AFBack.Features.Support.Models;
using AFBack.Features.SyncEvents.Models;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Security.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
namespace AFBack.Data;


public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    
    // Her definerer vi tabellene i databasen. AppUsers er brukere.
    public DbSet<AppUser> AppUsers { get; set; } // Bruker
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<UserProfile> Profiles { get; set; } // profilen til bruker
    public DbSet<UserSettings> UserSettings { get; set; } // Innstillinger til bruker
    public DbSet<Friendship> Friendships { get; set; } // Venner til bruker
    public DbSet<FriendshipRequest> FriendshipRequests { get; set; } // Venne invitasjoner til bruker
    public DbSet<Notification> Notifications { get; set; } = null!; // Notifications!
    
    public DbSet<ConversationParticipant> ConversationParticipants { get; set; } 
    // Her her vi samtaler som kobler meldinger mot brukere/grupper
    public DbSet<Conversation> Conversations { get; set; } // Samtaler mellom brukere
    
    public DbSet<Reaction> Reactions { get; set; } // Reaksjoner
    public DbSet<MessageNotification> MessageNotifications { get; set; } // MessageNotifications
    public DbSet<GroupEvent> GroupEvents { get; set; }
    
    public DbSet<MessageNotificationGroupEvent> MessageNotificationGroupEvents { get; set; }
    
    public DbSet<UserBlock> UserBlocks { get; set; }
    
    public DbSet<CanSend> CanSends { get; set; }
    
    public DbSet<UserConnection> UserOnlineStatuses { get; set; }
    
    public DbSet<SyncEvent> SyncEvents { get; set; }
    
    
    public DbSet<IpBan> IpBans { get; set; }
    
    public DbSet<SuspiciousActivity> SuspiciousActivities { get; set; }
    
    public DbSet<UserPublicKey> UserPublicKeys { get; set; }
    
    public DbSet<Message> Messages { get; set; } 
    
    public DbSet<MessageAttachment> MessageAttachments { get; set; }
    
    public DbSet<DeviceSyncState> DeviceSyncStates { get; set; }
    
    public DbSet<ConversationLeftRecord> ConversationLeftRecords { get; set; }
    
    public DbSet<UserDevice> UserDevices { get; set; }
    
    public DbSet<VerificationInfo> VerificationInfos { get; set; }
    
    public DbSet<LoginHistory> LoginHistories { get; set; }
    
    public DbSet<SupportTicket> SupportTickets { get; set; }
    
    public DbSet<UserReport> UserReports { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // ==================== USER ====================
        // Kun et telefonnummer pr bruker
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(e => e.PhoneNumber)
                .IsUnique();
        });
    
        // ==================== USER PROFILE ====================
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasOne(p => p.AppUser)
                .WithOne(u => u.UserProfile)
                .HasForeignKey<UserProfile>(p => p.UserId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== USER SETTINGS  ====================
        modelBuilder.Entity<UserSettings>(entity =>
        {
            entity.HasOne(s => s.AppUser)
                .WithOne(u => u.UserSettings)
                .HasForeignKey<UserSettings>(s => s.UserId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== USER DEVICE ====================
        modelBuilder.Entity<UserDevice>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.UserId);
            
            // --- Relationships --- //
            entity.HasOne(d => d.AppUser)
                .WithMany(u => u.Devices)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // ==================== USER CONNECTION ====================
        modelBuilder.Entity<UserConnection>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.UserDeviceId);
            
            // --- Indexes --- //
            entity.HasIndex(e => e.LastHeartbeat);
            entity.HasIndex(e => e.ConnectionId)
                .IsUnique();
        
            // --- Relationships --- //
            entity.HasOne(c => c.AppUser)
                .WithMany(u => u.Connections)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        
            entity.HasOne(c => c.UserDevice)
                .WithMany(d => d.Connections)
                .HasForeignKey(c => c.UserDeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== LOGIN HISTORY ====================
        modelBuilder.Entity<LoginHistory>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.UserDeviceId);
            entity.HasIndex(e => e.SuspiciousActivityId);
            
            // --- Relationships --- //
            entity.HasOne(l => l.AppUser)
                .WithMany(u => u.LoginHistory)
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(l => l.UserDevice)
                .WithMany(d => d.LoginHistory)
                .HasForeignKey(l => l.UserDeviceId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(l => l.SuspiciousActivity)
                .WithMany()
                .HasForeignKey(l => l.SuspiciousActivityId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // ==================== BAN INFO ====================
        modelBuilder.Entity<IpBan>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(b => b.BannedByUserId); 
            entity.HasIndex(b => b.UnbannedByUserId);
            
            // --- Relationships --- //
            entity.HasOne(b => b.BannedByUser)
                .WithMany()
                .HasForeignKey(b => b.BannedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
    
            entity.HasOne(b => b.UnbannedByUser)
                .WithMany()
                .HasForeignKey(b => b.UnbannedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // ==================== SUSPICIOUS ACTIVITY ====================
        modelBuilder.Entity<SuspiciousActivity>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.UserDeviceId);
            
            // --- Relationships --- //
            entity.HasOne(s => s.User)
                .WithMany(u => u.SuspiciousActivities)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(s => s.UserDevice)
                .WithMany(u => u.SuspiciousActivities)
                .HasForeignKey(s => s.UserDeviceId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // ==================== REFRESH TOKEN ====================
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.UserDeviceId);
            
            // --- Indexes --- //
            entity.HasIndex(e => e.Token)
                .IsUnique(); 
            
            // --- Relationships --- //
            entity.HasOne(r => r.AppUser)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
    
            entity.HasOne(r => r.UserDevice)
                .WithMany(d => d.RefreshTokens)
                .HasForeignKey(r => r.UserDeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== USER PUBLIC KEY ====================
        modelBuilder.Entity<UserPublicKey>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(pk => pk.UserId);
    
            // --- Relationships --- //
            entity.HasOne(pk => pk.User)
                .WithMany(u => u.PublicKeys)
                .HasForeignKey(pk => pk.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== CANSEND ====================
        modelBuilder.Entity<CanSend>(entity =>
        {
            // --- Compound Primary Key --- //
            entity.HasKey(cs => new { cs.UserId, cs.ConversationId });
            
            // --- Foreign Key Indexes --- //
            entity.HasIndex(cs => cs.UserId);
            entity.HasIndex(cs => cs.ConversationId);
            
            // --- Relationships --- //
            entity.HasOne(cs => cs.AppUser)
                .WithMany(u => u.CanSendTo)
                .HasForeignKey(cs => cs.UserId)
                .OnDelete(DeleteBehavior.Cascade);
    
            entity.HasOne(cs => cs.Conversation)
                .WithMany(c => c.CanSend)
                .HasForeignKey(cs => cs.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== CONVERSATION ====================
        modelBuilder.Entity<Conversation>();
        
        // ==================== CONVERSATION PARTICIPANT ====================
        modelBuilder.Entity<ConversationParticipant>(entity =>
        {
            // --- Compound Primary Key --- //
            entity.HasKey(cp => new { cp.UserId, cp.ConversationId });
    
            // --- Foreign Key Indexes --- //
            entity.HasIndex(cp => cp.UserId);
            entity.HasIndex(cp => cp.ConversationId);
            
            // --- Useful composite indexes --- //
            entity.HasIndex(cp => new { cp.UserId, HasDeleted = cp.ConversationArchived, ConversationStatus = cp.Status });
            entity.HasIndex(cp => new { cp.UserId, ConversationStatus = cp.Status });
    
            // --- Relationships --- //
            entity.HasOne(cp => cp.AppUser)
                .WithMany(u => u.ConversationParticipants) 
                .HasForeignKey(cp => cp.UserId)
                .OnDelete(DeleteBehavior.Cascade);
    
            entity.HasOne(cp => cp.Conversation)
                .WithMany(c => c.Participants)
                .HasForeignKey(cp => cp.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== MESSAGE ====================
        modelBuilder.Entity<Message>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(m => m.ConversationId);
            entity.HasIndex(m => m.SenderId); 
            
            // --- Indexes --- //
            entity.HasIndex(m => m.ParentMessageId);
    
            // --- Relationships --- //
            entity.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.SetNull);  
    
            entity.HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
    
            entity.HasOne(m => m.ParentMessage)
                .WithMany()
                .HasForeignKey(m => m.ParentMessageId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        // ==================== MESSAGE ATTACHMENT ====================
        modelBuilder.Entity<MessageAttachment>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(ma => ma.MessageId);
    
            // --- Relationships --- //
            entity.HasOne(ma => ma.Message)
                .WithMany(m => m.Attachments)
                .HasForeignKey(ma => ma.MessageId)
                .OnDelete(DeleteBehavior.Cascade); 
        });
        
        // ======================== CONVERSATIONLEFTRECORD ========================
        modelBuilder.Entity<ConversationLeftRecord>(entity =>
        {
            // --- Compound Primary Key --- //
            entity.HasKey(clr => new { clr.UserId, clr.ConversationId });
            
            // --- Foreign Key Indexes --- //
            entity.HasIndex(clr => clr.ConversationId);
        
            // --- Relationships --- //
            entity.HasOne(clr => clr.User)
                .WithMany()
                .HasForeignKey(clr => clr.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(clr => clr.Conversation)
                .WithMany(c => c.LeftGroupRecords)
                .HasForeignKey(clr => clr.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== USERBLOCKS ====================
        modelBuilder.Entity<UserBlock>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(ub => ub.BlockedUserId);

            // --- Relationships --- //
            // Relasjon til Blocker (brukeren som blokkerer)
            entity.HasOne(ub => ub.Blocker)
                .WithMany()
                .HasForeignKey(ub => ub.BlockerId)
                .OnDelete(DeleteBehavior.Restrict); 

            // Relasjon til BlockedUser (brukeren som blir blokkert)
            entity.HasOne(ub => ub.BlockedAppUser)
                .WithMany() 
                .HasForeignKey(ub => ub.BlockedUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        // ==================== DeviceSyncState ====================
        modelBuilder.Entity<DeviceSyncState>(entity =>
        {
            // --- Primary Key (satt til hver device) --- //
            entity.HasKey(e => e.UserDeviceId);
    
            // --- Relationships --- //
            entity.HasOne(e => e.UserDevice)
                .WithOne(ud => ud.SyncState)
                .HasForeignKey<DeviceSyncState>(e => e.UserDeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== GroupEvent ====================
        modelBuilder.Entity<GroupEvent>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(ge => ge.ConversationId);
            entity.HasIndex(ge => ge.TriggeredByUserId);
    
            // --- Relationships --- //
            entity.HasOne(ge => ge.Conversation)
                .WithOne()
                .HasForeignKey<GroupEvent>(ge => ge.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            
            // --- Relationships --- //
            entity.HasOne(ge => ge.TriggeredByUser)
                .WithOne()
                .HasForeignKey<GroupEvent>(ge => ge.TriggeredByUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== MessageNotificationGroupEvent ====================
        modelBuilder.Entity<MessageNotificationGroupEvent>(entity =>
        {
            // --- Compound Primary Key --- //
            entity.HasKey(e => new { e.MessageNotificationId, e.GroupEventId });

            // --- Relationships --- //
            // Relasjon til GruppeEventer
            entity.HasOne(mge => mge.GroupEvent)
                .WithMany()
                .HasForeignKey(mge => mge.GroupEventId)
                .OnDelete(DeleteBehavior.Cascade);

            // Relasjon til MessageNotificaiton
            entity.HasOne(mge => mge.MessageNotification)
                .WithMany()
                .HasForeignKey(mge => mge.MessageNotificationId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== Notificaiton ====================
        modelBuilder.Entity<Notification>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(n => n.RecipientUserId);
            entity.HasIndex(n => n.RelatedUserId);

            // --- Relationships --- //
            entity.HasOne(n => n.RecipientUser)
                .WithMany()
                .HasForeignKey(n => n.RecipientUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.RelatedUser)
                .WithMany()
                .HasForeignKey(n => n.RelatedUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        // ==================== FriendshipRequests ====================
        modelBuilder.Entity<FriendshipRequest>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(i => i.SenderId);
            entity.HasIndex(i => i.ReceiverId);

            // --- Useful composite index (hent pending requests for en bruker) --- //
            entity.HasIndex(i => new { i.ReceiverId, i.Status });

            // --- Relationships --- //
            entity.HasOne(i => i.Sender)
                .WithMany()
                .HasForeignKey(i => i.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(i => i.Receiver)
                .WithMany()
                .HasForeignKey(i => i.ReceiverId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        // ==================== FriendshipRequests ====================
        modelBuilder.Entity<Friendship>(entity =>
        {
            // --- Compound Primary Key --- //
            entity.HasKey(f => new { f.UserId, f.FriendId });

            // --- Foreign Key Indexes --- //
            entity.HasIndex(f => f.FriendId); // UserId dekkes av compound PK

            // --- Relationships --- //
            entity.HasOne(f => f.User)
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(f => f.Friend)
                .WithMany()
                .HasForeignKey(f => f.FriendId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        // ==================== Reaction ====================
        modelBuilder.Entity<Reaction>(entity =>
        {
            // --- Compound Primary Key --- //
            entity.HasKey(r => new { r.MessageId, r.UserId });

            // --- Foreign Key Indexes --- //
            entity.HasIndex(r => r.UserId); 

            // --- Relationships --- //
            entity.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Message)
                .WithMany(m => m.Reactions)
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== SupportTicket ====================
        modelBuilder.Entity<SupportTicket>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(st => st.SubmittedByUserId);

            // --- Relationships --- //
            entity.HasOne(st => st.SubmittedByUser)
                .WithMany()
                .HasForeignKey(st => st.SubmittedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(st => st.Attachments)
                .WithOne(a => a.SupportTicket)
                .HasForeignKey(a => a.SupportTicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
       
        
        
        
        // ==================== UserReport ====================
        modelBuilder.Entity<UserReport>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(ur => ur.SubmittedByUserId);
            entity.HasIndex(ur => ur.ReportedUserId);
            
            // --- Relationships --- //
            entity.HasOne(ur => ur.SubmittedByUser)
                .WithMany()
                .HasForeignKey(ur => ur.SubmittedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(ur => ur.ReportedUser)
                .WithMany()
                .HasForeignKey(ur => ur.ReportedUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(ur => ur.Attachments)
                .WithOne(a => a.UserReport)
                .HasForeignKey(a => a.UserReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        
        // ==================== VerificationInfo ====================
        modelBuilder.Entity<VerificationInfo>(entity =>
        {
            // --- Primary Key (satt til hver device) --- //
            entity.HasKey(vi => vi.UserId);
    
            // --- Relationships --- //
            entity.HasOne(vi => vi.AppUser)
                .WithOne(u => u.VerificationInfo)
                .HasForeignKey<VerificationInfo>(vi => vi.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        
        // ==================== MESSAGE NOTIFICATION ====================
        modelBuilder.Entity<MessageNotification>(entity =>
        {
            entity.HasKey(e => e.Id);

            // --- Type Conversion --- //
            entity.Property(e => e.Type)
                .IsRequired()
                .HasConversion<int>();

            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.RecipientId);
            entity.HasIndex(e => e.SenderId);
            entity.HasIndex(e => e.MessageId);
            entity.HasIndex(e => e.ConversationId);

            // --- Composite Indexes --- //
            entity.HasIndex(e => new { e.RecipientId, e.Type, e.IsRead });
            entity.HasIndex(e => new { e.ConversationId, e.Type, e.IsRead });

            // Unique constraint for GroupEvent notifikasjoner
            entity.HasIndex(e => new { e.RecipientId, e.ConversationId, e.Type, e.IsRead })
                .HasFilter("\"Type\" = 8 AND \"IsRead\" = false")
                .HasDatabaseName("IX_MessageNotification_UniqueGroupEvent");

            // --- Relationships --- //
            entity.HasOne(n => n.RecipientUser)
                .WithMany()
                .HasForeignKey(n => n.RecipientId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.SenderUser)
                .WithMany()
                .HasForeignKey(n => n.SenderId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(n => n.Message)
                .WithMany()
                .HasForeignKey(n => n.MessageId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(n => n.Conversation)
                .WithMany()
                .HasForeignKey(n => n.ConversationId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // ==================== Sync Event====================
        modelBuilder.Entity<SyncEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
    
            // --- Foreign Key Indexes --- //
            entity.HasIndex(e => e.UserId);
            
            // --- Indexes --- //
            // Composite index for sync queries (hent events for bruker etter tid)
            entity.HasIndex(e => new { e.UserId, e.CreatedAt })
                .HasDatabaseName("IX_SyncEvent_UserId_CreatedAt");
    
            // --- Relationships --- //
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
     
        
        // Seeder roller
        modelBuilder.Entity<IdentityRole>().HasData(
            new IdentityRole
            {
                Id = "1",
                Name = AppRoles.Admin,
                NormalizedName = AppRoles.Admin.ToUpperInvariant()
            },
            new IdentityRole
            {
                Id = "2",
                Name = AppRoles.User,
                NormalizedName = AppRoles.User.ToUpperInvariant()
            });

    }

}
