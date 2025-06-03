using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageCountToMessageNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MessageCount",
                table: "MessageNotifications",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MessageCount",
                table: "MessageNotifications");
        }
    }
}
