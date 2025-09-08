using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class ChangedEncryptedAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EncryptedAttachments_EncryptedMessages_MessageId",
                table: "EncryptedAttachments");

            migrationBuilder.RenameColumn(
                name: "MessageId",
                table: "EncryptedAttachments",
                newName: "EncryptedMessageId");

            migrationBuilder.RenameColumn(
                name: "FileSize",
                table: "EncryptedAttachments",
                newName: "OriginalFileSize");

            migrationBuilder.RenameColumn(
                name: "FileName",
                table: "EncryptedAttachments",
                newName: "OriginalFileName");

            migrationBuilder.RenameIndex(
                name: "IX_EncryptedAttachments_MessageId",
                table: "EncryptedAttachments",
                newName: "IX_EncryptedAttachments_EncryptedMessageId");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "EncryptedAttachments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddForeignKey(
                name: "FK_EncryptedAttachments_EncryptedMessages_EncryptedMessageId",
                table: "EncryptedAttachments",
                column: "EncryptedMessageId",
                principalTable: "EncryptedMessages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EncryptedAttachments_EncryptedMessages_EncryptedMessageId",
                table: "EncryptedAttachments");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "EncryptedAttachments");

            migrationBuilder.RenameColumn(
                name: "OriginalFileSize",
                table: "EncryptedAttachments",
                newName: "FileSize");

            migrationBuilder.RenameColumn(
                name: "OriginalFileName",
                table: "EncryptedAttachments",
                newName: "FileName");

            migrationBuilder.RenameColumn(
                name: "EncryptedMessageId",
                table: "EncryptedAttachments",
                newName: "MessageId");

            migrationBuilder.RenameIndex(
                name: "IX_EncryptedAttachments_EncryptedMessageId",
                table: "EncryptedAttachments",
                newName: "IX_EncryptedAttachments_MessageId");

            migrationBuilder.AddForeignKey(
                name: "FK_EncryptedAttachments_EncryptedMessages_MessageId",
                table: "EncryptedAttachments",
                column: "MessageId",
                principalTable: "EncryptedMessages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
