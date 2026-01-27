using AFBack.Features.CanSend.Models;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Friendship.Models;
using AFBack.Features.MessageNotification.Models;
using AFBack.Features.Messaging.Models;
using AFBack.Features.SyncEvents.Models;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.Models.Auth;
using AFBack.Models.Crypto;
using AFBack.Models.Enums;
using AFBack.Models.User;


namespace AFBack.Data;
// 10.03
// Denne klassen gjør at vi kan jobbe med databasen uten å skrive SQL, kun brukek C# objekter.
public class ApplicationDbContext : DbContext
{
    // konstruktøren
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) {}
    
    // Her definerer vi tabellene i databasen. AppUsers er brukere.
    public DbSet<AppUser> AppUsers { get; set; } // Bruker
    public DbSet<VerificationInfo> VerificationInfos { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<UserProfile> Profiles { get; set; } // profilen til bruker
    public DbSet<UserSettings> UserSettings { get; set; } // Innstillinger til bruker
    public DbSet<Friendship> Friends { get; set; } // Venner til bruker
    public DbSet<FriendInvitation> FriendInvitations { get; set; } // Venne invitasjoner til bruker
    public DbSet<Notification> Notifications { get; set; } = null!; // Notifications!
    
    public DbSet<ConversationParticipant> ConversationParticipants { get; set; } 
    // Her her vi samtaler som kobler meldinger mot brukere/grupper
    public DbSet<Conversation> Conversations { get; set; } // Samtaler mellom brukere
    public DbSet<ConversationReadState> ConversationReadStates { get; set; } // Leste samtaler
    
    public DbSet<MessageRequest> MessageRequests { get; set; } // Lagre meldings requester
    
    public DbSet<GroupRequest> GroupRequests { get; set; }
    public DbSet<Reaction> Reactions { get; set; } // Reaksjoner
    public DbSet<MessageNotification> MessageNotifications { get; set; } // MessageNotifications
    public DbSet<GroupEvent> GroupEvents { get; set; }
    
    public DbSet<MessageNotificationGroupEvent> MessageNotificationGroupEvents { get; set; }
    
    public DbSet<GroupEventAffectedUser> GroupEventAffectedUsers { get; set; }
    
    public DbSet<UserBlock> UserBlocks { get; set; }
    
    public DbSet<CanSend> CanSends { get; set; }
    
    public DbSet<UserConnection> UserOnlineStatuses { get; set; }
    
    public DbSet<SyncEvent> SyncEvents { get; set; }
    
    public DbSet<Report> Reports { get; set; }
    
    public DbSet<ReportAttachment> ReportAttachments { get; set; }
    
    public DbSet<BanInfo> BanInfos { get; set; }
    
    public DbSet<SuspiciousActivity> SuspiciousActivities { get; set; }
    
    public DbSet<UserPublicKey> UserPublicKeys { get; set; }
    
    public DbSet<Message> Messages { get; set; } 
    
    public DbSet<MessageAttachment> MessageAttachments { get; set; }
    
    public DbSet<DeviceSyncState> DeviceSyncStates { get; set; }
    
    public DbSet<ConversationLeftRecord> ConversationLeftRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // ==================== USER ====================
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(e => e.Email)
                .IsUnique();
        
            entity.HasIndex(e => e.Phone)
                .IsUnique()
                .HasFilter("\"Phone\" IS NOT NULL");
        });
    
        // ==================== USER PROFILE ====================
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasOne(p => p.AppUser)
                .WithOne(u => u.UserProfile)
                .HasForeignKey<UserProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== USER SETTINGS  ====================
        modelBuilder.Entity<UserSettings>(entity =>
        {
            entity.HasOne(s => s.AppUser)
                .WithOne(u => u.UserSettings)
                .HasForeignKey<UserSettings>(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ==================== VERIFICATION INFO ====================
        modelBuilder.Entity<VerificationInfo>(entity =>
        {
            entity.HasOne(v => v.AppUser)
                .WithOne(u => u.VerificationInfo)
                .HasForeignKey<VerificationInfo>(v => v.UserId)
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
        modelBuilder.Entity<BanInfo>(entity =>
        {
            // --- Foreign Key Indexes --- //
            entity.HasIndex(b => b.UserId); 
            entity.HasIndex(b => b.UserDeviceId); 
            entity.HasIndex(b => b.BannedByUserId); 
            entity.HasIndex(b => b.UnbannedByUserId);
            
            // --- Relationships --- //
            entity.HasOne(b => b.User)
                .WithMany(u => u.Bans)
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.SetNull);
    
            entity.HasOne(b => b.UserDevice)
                .WithMany(d => d.Bans)
                .HasForeignKey(b => b.UserDeviceId)
                .OnDelete(DeleteBehavior.SetNull);
    
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
                .IsUnique(); // TODO: Legge til retry hvis vi genrer en lik token som før
            
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
        
        
        // venneliste med composite key. .HasKey definerer en primarykey basert på UserId og FriendId
        modelBuilder.Entity<Friendship>()
            .HasKey(f => new { f.UserId, f.FriendId });
        
        // Knytter AppUser og FriendUser som foreign key, sjekker begge veier fra UserId til FriendId og motsatt
        modelBuilder.Entity<Friendship>()
            .HasOne(f => f.User)
            .WithMany()
            .HasForeignKey("UserId")
            .OnDelete(DeleteBehavior.Restrict); // onDelete sikrer at vi ikke får slettet en bruker som har venner
        
        modelBuilder.Entity<Friendship>()
            .HasOne(f => f.FriendUser)
            .WithMany()
            .HasForeignKey("FriendId")
            .OnDelete(DeleteBehavior.Restrict);
        // Her håndterer vi venneforespørsler
        modelBuilder.Entity<FriendInvitation>()
            .HasOne(i => i.Sender)
            .WithMany()
            .HasForeignKey(i => i.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FriendInvitation>()
            .HasOne(i => i.Receiver)
            .WithMany()
            .HasForeignKey(i => i.ReceiverId)
            .OnDelete(DeleteBehavior.Restrict);
        
        // Til notifikasjoner: Hvis en bruker slettes så slettes også notifkasjonene
        modelBuilder.Entity<Notification>()
            .HasOne(n => n.RecipientUser)
            .WithMany()
            .HasForeignKey(n => n.RecipientUserId)
            .OnDelete(DeleteBehavior.Cascade); 
        
        // Til notifikasjoner: Hvis en bruker eksistere så slettes de ikke
        modelBuilder.Entity<Notification>()
            .HasOne(n => n.RelatedUser)
            .WithMany()
            .HasForeignKey(n => n.RelatedUserId)
            .OnDelete(DeleteBehavior.Restrict); 
        
        modelBuilder.Entity<Notification>()
            .Property(n => n.Type)
            .HasConversion<string>(); // 🔹 konverter enum til string
        
        // MessageAttachment entity configuration
        modelBuilder.Entity<MessageAttachment>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.EncryptedFileUrl).IsRequired();
            entity.Property(a => a.FileType).IsRequired();
            entity.Property(a => a.OriginalFileName).HasMaxLength(255);
            entity.Property(a => a.KeyInfo).IsRequired();
            entity.Property(a => a.IV).IsRequired();
    
            // Relationship til Message (allerede definert i Message entity, men kan være eksplisitt)
            entity.HasOne(a => a.Message)
                .WithMany(m => m.Attachments)
                .HasForeignKey(a => a.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        
        // Reaksjoner
        modelBuilder.Entity<Reaction>()
            .HasKey(r => new { r.MessageId, r.UserId }); // Kombinasjon kan være naturlig PK

        modelBuilder.Entity<Reaction>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Reaction>()
            .HasOne(r => r.Message)
            .WithMany(m => m.Reactions)
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // For å sjekke om en bruker har lest samtalene sine
        modelBuilder.Entity<ConversationReadState>()
            .HasKey(crs => crs.Id);

        modelBuilder.Entity<ConversationReadState>()
            .HasOne(crs => crs.User)
            .WithMany()
            .HasForeignKey(crs => crs.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ConversationReadState>()
            .HasOne(crs => crs.Conversation)
            .WithMany()
            .HasForeignKey(crs => crs.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);
        
        modelBuilder.Entity<ConversationReadState>()
            .HasIndex(crs => new { crs.UserId, crs.ConversationId })
            .IsUnique();
        
        
        // Meldingsforespørsler (MessageRequest)
        modelBuilder.Entity<MessageRequest>()
            .HasKey(mr => mr.Id);

        modelBuilder.Entity<MessageRequest>()
            .HasOne(mr => mr.Sender)
            .WithMany()
            .HasForeignKey(mr => mr.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Valgfritt: legg til en unik indeks for å unngå duplikate forespørsler mellom samme brukere
        modelBuilder.Entity<MessageRequest>()
            .HasIndex(mr => new { mr.SenderId, mr.ReceiverId })
            .IsUnique();
        
        // Koble MessageRequesten med en sepsifikk samtale
        modelBuilder.Entity<MessageRequest>()
            .Property(mr => mr.ConversationId)
            .IsRequired(); // 👈 Gjør feltet NOT NULL

        modelBuilder.Entity<MessageRequest>()
            .HasOne(mr => mr.Conversation)
            .WithMany()
            .HasForeignKey(mr => mr.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // MessageNotificaitons
        
        modelBuilder.Entity<MessageNotification>(entity =>
        {
            entity.HasKey(e => e.Id);

            // Type konvertering
            entity.Property(e => e.Type)
                .IsRequired()
                .HasConversion<int>();

            // FJERNET: GroupEventIdsJson og EventCount (erstattes med relasjonstabell)
            // FJERNET: LastUpdatedAt (kan beholdes hvis du trenger den til andre formål)

            // Relasjoner (samme som før)
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

            // FJERNET: Ignore GroupEventIds (ikke lenger nødvendig)

            // Oppdaterte indekser
            entity.HasIndex(e => new { UserId = e.RecipientId, e.Type, e.IsRead });
            entity.HasIndex(e => new { e.ConversationId, e.Type, e.IsRead });
            
            // ENDRET: Unique constraint for GroupEvent notifikasjoner (forenklet)
            entity.HasIndex(e => new { UserId = e.RecipientId, e.ConversationId, e.Type, e.IsRead })
                .HasFilter("\"Type\" = 8 AND \"IsRead\" = false")
                .HasDatabaseName("IX_MessageNotification_UniqueGroupEvent");
        });

        // NY: Legg til konfigurasjon for MessageNotificationGroupEvent
        modelBuilder.Entity<MessageNotificationGroupEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique constraint - samme GroupEvent kan ikke være knyttet til samme notification flere ganger
            entity.HasIndex(e => new { e.MessageNotificationId, e.GroupEventId })
                .IsUnique()
                .HasDatabaseName("IX_MessageNotificationGroupEvent_NotificationId_EventId");
            
            // Separate indekser for ytelse
            entity.HasIndex(e => e.MessageNotificationId)
                .HasDatabaseName("IX_MessageNotificationGroupEvent_NotificationId");
                
            entity.HasIndex(e => e.GroupEventId)
                .HasDatabaseName("IX_MessageNotificationGroupEvent_EventId");
            
            // Relasjoner
            entity.HasOne(e => e.MessageNotification)
                .WithMany(n => n.GroupEvents)
                .HasForeignKey(e => e.MessageNotificationId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.GroupEvent)
                .WithMany()
                .HasForeignKey(e => e.GroupEventId)
                .OnDelete(DeleteBehavior.Restrict); // Ikke slett GroupEvents når notifications slettes
        });


        modelBuilder.Entity<GroupRequest>()
            .HasOne(gr => gr.Sender)
            .WithMany()
            .HasForeignKey(gr => gr.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupRequest>()
            .HasOne(gr => gr.Receiver)
            .WithMany()
            .HasForeignKey(gr => gr.ReceiverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupRequest>()
            .HasOne(gr => gr.Conversation)
            .WithMany()
            .HasForeignKey(gr => gr.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);
        
        modelBuilder.Entity<GroupRequest>()
            .HasIndex(gr => new { gr.ReceiverId, gr.ConversationId })
            .IsUnique(true); // Sett til true hvis du vil nekte duplikater
        
        // Gruppe events
        modelBuilder.Entity<GroupEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
    
            entity.Property(e => e.EventType)
                .IsRequired()
                .HasConversion<int>();
    
            // FJERNET: AffectedUserIdsJson property (ikke lenger nødvendig)
    
            entity.Property(e => e.Metadata)
                .HasMaxLength(4000);

            // Relasjoner
            entity.HasOne(e => e.Conversation)
                .WithMany()
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.ActorUser)
                .WithMany()
                .HasForeignKey(e => e.ActorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // FJERNET: Ignore AffectedUserIds (ikke lenger nødvendig)

            // Indekser (samme som før)
            entity.HasIndex(e => new { e.ConversationId, e.CreatedAt });
            entity.HasIndex(e => e.ActorUserId);
        });

// NY: Legg til konfigurasjon for GroupEventAffectedUser
        modelBuilder.Entity<GroupEventAffectedUser>(entity =>
        {
            entity.HasKey(e => e.Id);
    
            // Unique constraint - en appUser kan bare være affected én gang per event
            entity.HasIndex(e => new { e.GroupEventId, e.UserId })
                .IsUnique()
                .HasDatabaseName("IX_GroupEventAffectedUser_GroupEventId_UserId");
    
            // Separate indekser for ytelse
            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_GroupEventAffectedUser_UserId");
        
            entity.HasIndex(e => e.GroupEventId)
                .HasDatabaseName("IX_GroupEventAffectedUser_GroupEventId");
    
            // Relasjoner
            entity.HasOne(e => e.GroupEvent)
                .WithMany(g => g.AffectedUsers)
                .HasForeignKey(e => e.GroupEventId)
                .OnDelete(DeleteBehavior.Cascade);
        
            entity.HasOne(e => e.AppUser)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict); // Ikke slett brukere når events slettes
        });
        
        modelBuilder.Entity<SyncEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
    
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
    
            // Primary index for sync queries (mest brukte)
            entity.HasIndex(e => new { e.UserId, e.CreatedAt })
                .HasDatabaseName("IX_SyncEvent_UserId_CreatedAt");
    
            // Index for cleanup operations
            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("IX_SyncEvent_CreatedAt");
    
            // Index for debugging og søk basert på relaterte entiteter
            entity.HasIndex(e => new { e.RelatedEntityType, e.RelatedEntityId })
                .HasDatabaseName("IX_SyncEvent_RelatedEntity")
                .HasFilter("\"RelatedEntityId\" IS NOT NULL"); // Conditional index
            
        });
        
        modelBuilder.Entity<Report>(entity =>
        {
            // Primary key
            entity.HasKey(r => r.Id);
            
            // Required fields
            entity.Property(r => r.Type)
                .IsRequired()
                .HasConversion<int>(); // Lagrer enum som int
                
            entity.Property(r => r.Title)
                .IsRequired()
                .HasMaxLength(200);
                
            entity.Property(r => r.Description)
                .IsRequired()
                .HasMaxLength(5000);
                
            entity.Property(r => r.SubmittedAt)
                .IsRequired()
                .HasDefaultValueSql("NOW()"); // PostgreSQL
                
            entity.Property(r => r.Priority)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(PriorityEnum.Medium);
                
            entity.Property(r => r.Status)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(ReportStatusEnum.Open);
                
            // Optional fields with max lengths
            entity.Property(r => r.ReportedUserId)
                .HasMaxLength(50);
                
            entity.Property(r => r.StepsToReproduce)
                .HasMaxLength(2000);
                
            entity.Property(r => r.ExpectedBehavior)
                .HasMaxLength(1000);
                
            entity.Property(r => r.ActualBehavior)
                .HasMaxLength(1000);
                
            entity.Property(r => r.UserAgent)
                .HasMaxLength(500);
                
            entity.Property(r => r.BrowserVersion)
                .HasMaxLength(100);
                
            entity.Property(r => r.DeviceInfo)
                .HasMaxLength(200);
                
            entity.Property(r => r.AssignedTo)
                .HasMaxLength(100);
                
            entity.Property(r => r.Resolution)
                .HasMaxLength(2000);
                
            // FJERNET: AttachmentsJson konfigurasjonen
            // entity.Property(r => r.AttachmentsJson)
            //     .HasColumnType("text"); 
            
            // Navigation property til ReportAttachments
            entity.HasMany(r => r.Attachments)
                .WithOne(a => a.Report)
                .HasForeignKey(a => a.ReportId)
                .OnDelete(DeleteBehavior.Cascade); // Når rapport slettes, slettes også alle attachments
                
            // Indexes for performance
            entity.HasIndex(r => r.Type)
                .HasDatabaseName("IX_Report_Type");
                
            entity.HasIndex(r => r.Status)
                .HasDatabaseName("IX_Report_Status");
                
            entity.HasIndex(r => r.SubmittedByUserId)
                .HasDatabaseName("IX_Report_SubmittedByUserId");
                
            entity.HasIndex(r => r.SubmittedAt)
                .HasDatabaseName("IX_Report_SubmittedAt");
                
            entity.HasIndex(r => new { r.Type, r.Status })
                .HasDatabaseName("IX_Report_Type_Status");
                
            // Table name
            entity.ToTable("Reports");
        });
        
        modelBuilder.Entity<ReportAttachment>(entity =>
        {
            // Primary key
            entity.HasKey(a => a.Id);
    
            // Required fields
            entity.Property(a => a.FileUrl)
                .IsRequired()
                .HasMaxLength(500);
        
            entity.Property(a => a.FileType)
                .IsRequired()
                .HasMaxLength(100);
        
            entity.Property(a => a.UploadedAt)
                .IsRequired()
                .HasDefaultValueSql("NOW()");
        
            // Optional fields
            entity.Property(a => a.FileName)
                .HasMaxLength(255);
        
            // Foreign key relationship (allerede definert i Report konfigurasjonen, men kan være eksplisitt)
            entity.HasOne(a => a.Report)
                .WithMany(r => r.Attachments)
                .HasForeignKey(a => a.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
        
            // Index for performance på foreign key
            entity.HasIndex(a => a.ReportId)
                .HasDatabaseName("IX_ReportAttachment_ReportId");
        
            // Table name
            entity.ToTable("ReportAttachments");
        });
        
        
    }

}
