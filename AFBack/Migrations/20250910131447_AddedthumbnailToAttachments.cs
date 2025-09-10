using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddedthumbnailToAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ThumbnailHeight",
                table: "EncryptedAttachments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThumbnailIV",
                table: "EncryptedAttachments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThumbnailKeyInfo",
                table: "EncryptedAttachments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThumbnailUrl",
                table: "EncryptedAttachments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ThumbnailWidth",
                table: "EncryptedAttachments",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ThumbnailHeight",
                table: "EncryptedAttachments");

            migrationBuilder.DropColumn(
                name: "ThumbnailIV",
                table: "EncryptedAttachments");

            migrationBuilder.DropColumn(
                name: "ThumbnailKeyInfo",
                table: "EncryptedAttachments");

            migrationBuilder.DropColumn(
                name: "ThumbnailUrl",
                table: "EncryptedAttachments");

            migrationBuilder.DropColumn(
                name: "ThumbnailWidth",
                table: "EncryptedAttachments");
        }
    }
}
