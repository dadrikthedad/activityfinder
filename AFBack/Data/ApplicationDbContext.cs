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
    }
}