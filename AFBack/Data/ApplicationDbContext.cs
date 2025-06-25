using Microsoft.EntityFrameworkCore;
using AFBack.Models;
namespace AFBack.Data;
// 10.03
// Denne klassen gjør at vi kan jobbe med databasen uten å skrive SQL, kun brukek C# objekter.
public class ApplicationDbContext : DbContext
{
    // konstruktøren
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) {}
    
    // Her definerer vi tabellene i databasen. Users er brukere.
    public DbSet<User> Users { get; set; } // Bruker
    public DbSet<Profile> Profiles { get; set; } // profilen til bruker
    public DbSet<UserSettings> UserSettings { get; set; } // Innstillinger til bruker
    public DbSet<Friends> Friends { get; set; } // Venner til bruker
    public DbSet<FriendInvitation> FriendInvitations { get; set; } // Venne invitasjoner til bruker
    public DbSet<Notification> Notifications { get; set; } = null!; // Notifications!
    public DbSet<Message> Messages { get; set; } // Meldinger mellom brukere
    public DbSet<MessageAttachment> MessageAttachments { get; set; } // Vedlegg til meldinger
    
    public DbSet<ConversationParticipant> ConversationParticipants { get; set; } // Her her vi samtaler som kobler meldinger mot brukere/grupper
    public DbSet<Conversation> Conversations { get; set; } // Samtaler mellom brukere
    public DbSet<ConversationReadState> ConversationReadStates { get; set; } // Leste samtaler
    
    public DbSet<MessageRequest> MessageRequests { get; set; } // Lagre meldings requester
    
    public DbSet<MessageBlock> MessageBlocks { get; set; } // Blokkere meldinger/avise meldingsforespørsel
    
    public DbSet<GroupRequest> GroupRequests { get; set; }
    public DbSet<Reaction> Reactions { get; set; } // Reaksjoner
    public DbSet<MessageNotification> MessageNotifications { get; set; } // MessageNotifications
    public DbSet<GroupEvent> GroupEvents { get; set; }


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // Bruker må ha unik epost
        modelBuilder.Entity<User>().HasIndex(user => user.Email).IsUnique();
        // bruker kan kun ha en profil
        modelBuilder.Entity<Profile>().HasOne(p => p.User).WithOne(u => u.Profile)
            .HasForeignKey<Profile>(p => p.UserId);
        // venneliste med composite key. .HasKey definerer en primarykey basert på UserId og FriendId
        modelBuilder.Entity<Friends>()
            .HasKey(f => new { f.UserId, f.FriendId });
        
        // Knytter User og FriendUser som foreign key, sjekker begge veier fra UserId til FriendId og motsatt
        modelBuilder.Entity<Friends>()
            .HasOne(f => f.User)
            .WithMany()
            .HasForeignKey("UserId")
            .OnDelete(DeleteBehavior.Restrict); // onDelete sikrer at vi ikke får slettet en bruker som har venner
        
        modelBuilder.Entity<Friends>()
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
        
        // Til meldinger mellom bruker og annen bruker eller gruppe
        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Text).HasMaxLength(5000);
            entity.HasMany(m => m.Attachments)
                .WithOne(a => a.Message)
                .HasForeignKey(a => a.MessageId)
                .OnDelete(DeleteBehavior.Cascade); // Hvis melding slettes, slettes vedleggene også
        });
        // Hvis en bruker slettes så slettes ikke alle meldinger
        modelBuilder.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);
        
        // Meldinger får med reaksjoner
        modelBuilder.Entity<Message>()
            .HasMany(m => m.Reactions)
            .WithOne(r => r.Message)
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);
        // Meldinger får med reply-to
        modelBuilder.Entity<Message>()
            .HasOne(m => m.ParentMessage)
            .WithMany()
            .HasForeignKey(m => m.ParentMessageId)
            .OnDelete(DeleteBehavior.Restrict);
        
        modelBuilder.Entity<MessageAttachment>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.FileUrl).IsRequired();
            entity.Property(a => a.FileType).IsRequired();
            entity.Property(a => a.FileName).HasMaxLength(255);
        });
        
        // Samtaler
        modelBuilder.Entity<Message>()
            .HasOne(m => m.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);
        
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
        
        // Samtaler
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.GroupName)
                .HasMaxLength(100);
            entity.Property(c => c.CreatorId)
                .IsRequired();
            entity.Property(c => c.IsApproved)
                .HasDefaultValue(false);
            entity.Property(c => c.LastMessageSentAt)
                .IsRequired(false);
        });

        modelBuilder.Entity<ConversationParticipant>()
            .HasOne(cp => cp.Conversation)
            .WithMany(c => c.Participants)
            .HasForeignKey(cp => cp.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ConversationParticipant>()
            .HasOne(cp => cp.User)
            .WithMany() // eller .WithMany(u => u.Conversations) hvis du har det i User.cs
            .HasForeignKey(cp => cp.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // Blokkerte brukere (Funker kun for meldinger i øyeblikket)
        modelBuilder.Entity<MessageBlock>()
            .HasOne(mb => mb.BlockedUser)
            .WithMany()
            .HasForeignKey(mb => mb.BlockedUserId)
            .OnDelete(DeleteBehavior.Restrict);
        
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
    
            // 🆕 Nye felter for GroupEvent notifikasjoner
            entity.Property(e => e.GroupEventIdsJson)
                .HasMaxLength(4000)
                .IsRequired(false); // Kun påkrevd for GroupEvent notifikasjoner
    
            entity.Property(e => e.EventCount)
                .IsRequired(false);
    
            entity.Property(e => e.LastUpdatedAt)
                .IsRequired(false);
    
            // Relasjoner
            entity.HasOne(n => n.User)
                .WithMany() // eller .WithMany(u => u.Notifications) hvis du har det
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.FromUser)
                .WithMany()
                .HasForeignKey(n => n.FromUserId)
                .OnDelete(DeleteBehavior.NoAction); // Unngå slettekjede

            entity.HasOne(n => n.Message)
                .WithMany()
                .HasForeignKey(n => n.MessageId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(n => n.Conversation)
                .WithMany()
                .HasForeignKey(n => n.ConversationId)
                .OnDelete(DeleteBehavior.SetNull);
    
            // 🆕 Ignorer computed property
            entity.Ignore(e => e.GroupEventIds);
    
            // 🆕 Indekser for GroupEvent notifikasjoner
            entity.HasIndex(e => new { e.UserId, e.Type, e.IsRead, e.LastUpdatedAt });
            entity.HasIndex(e => new { e.ConversationId, e.Type, e.IsRead });
    
            // 🆕 Unique constraint for uleste GroupEvent notifikasjoner
            entity.HasIndex(e => new { e.UserId, e.ConversationId, e.Type, e.IsRead })
                .IsUnique()
                .HasFilter("\"Type\" = 8 AND \"IsRead\" = false"); // 8 = NotificationType.GroupEvent
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
            
            entity.Property(e => e.AffectedUserIdsJson)
                .HasMaxLength(2000)
                .IsRequired();
            
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

            // Ignorer computed property
            entity.Ignore(e => e.AffectedUserIds);

            // Indekser
            entity.HasIndex(e => new { e.ConversationId, e.CreatedAt });
            entity.HasIndex(e => e.ActorUserId);
        });
        
    }
    // Sikre oppdatering av FullName ved oppdatering av first, middle eller lastname
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                entry.Entity.UpdateFullName();
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}