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
    
    public DbSet<GroupInviteRequest> GroupInviteRequests { get; set; } // Her har vi gruppeinvitasjoner
    public DbSet<Reaction> Reactions { get; set; } // Reaksjoner
    
    public DbSet<GroupBlock> GroupBlocks { get; set; }  // Blokkerte grupper
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
        
        // Til meldinger mellom bruker og annen bruker eller gruppe
        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Text).HasMaxLength(2000);
            entity.HasMany(m => m.Attachments)
                .WithOne(a => a.Message)
                .HasForeignKey(a => a.MessageId)
                .OnDelete(DeleteBehavior.Cascade); // Hvis melding slettes, slettes vedleggene også
        });
        
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
            entity.Property(c => c.GroupName).HasMaxLength(100);
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
        
        // Kun en MessageRequest pr bruker
        modelBuilder.Entity<MessageRequest>()
            .HasIndex(r => new { r.SenderId, r.ReceiverId })
            .IsUnique();
        
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
        
        // Blokkerte grupper
        modelBuilder.Entity<GroupBlock>()
            .HasKey(gb => gb.Id);

        modelBuilder.Entity<GroupBlock>()
            .HasOne(gb => gb.User)
            .WithMany()
            .HasForeignKey(gb => gb.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GroupBlock>()
            .HasOne(gb => gb.Conversation)
            .WithMany()
            .HasForeignKey(gb => gb.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GroupBlock>()
            .HasIndex(gb => new { gb.UserId, gb.ConversationId })
            .IsUnique();
        
        // Gruppeinvitasjoner
        modelBuilder.Entity<GroupInviteRequest>()
            .HasKey(g => g.Id);

        modelBuilder.Entity<GroupInviteRequest>()
            .HasOne(g => g.Inviter)
            .WithMany()
            .HasForeignKey(g => g.InviterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupInviteRequest>()
            .HasOne(g => g.InvitedUser)
            .WithMany()
            .HasForeignKey(g => g.InvitedUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupInviteRequest>()
            .HasOne(g => g.Conversation)
            .WithMany()
            .HasForeignKey(g => g.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GroupInviteRequest>()
            .HasIndex(g => new { g.ConversationId, g.InvitedUserId })
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
        
    }
}