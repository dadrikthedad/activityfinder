using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class EncryptedMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EncryptedMessageId",
                table: "Reactions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EncryptedMessages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SenderId = table.Column<int>(type: "integer", nullable: true),
                    EncryptedText = table.Column<string>(type: "text", nullable: true),
                    KeyInfo = table.Column<string>(type: "text", nullable: false),
                    IV = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    IsApproved = table.Column<bool>(type: "boolean", nullable: false),
                    ParentMessageId = table.Column<int>(type: "integer", nullable: true),
                    ParentMessagePreview = table.Column<string>(type: "text", nullable: true),
                    IsSystemMessage = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncryptedMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EncryptedMessages_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EncryptedMessages_EncryptedMessages_ParentMessageId",
                        column: x => x.ParentMessageId,
                        principalTable: "EncryptedMessages",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_EncryptedMessages_Users_SenderId",
                        column: x => x.SenderId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UserPublicKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    PublicKey = table.Column<string>(type: "text", nullable: false),
                    KeyVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPublicKeys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPublicKeys_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EncryptedAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageId = table.Column<int>(type: "integer", nullable: false),
                    EncryptedFileUrl = table.Column<string>(type: "text", nullable: false),
                    FileType = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    KeyInfo = table.Column<string>(type: "text", nullable: false),
                    IV = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncryptedAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EncryptedAttachments_EncryptedMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "EncryptedMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reactions_EncryptedMessageId",
                table: "Reactions",
                column: "EncryptedMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_EncryptedAttachments_MessageId",
                table: "EncryptedAttachments",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_EncryptedMessages_ConversationId",
                table: "EncryptedMessages",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_EncryptedMessages_ParentMessageId",
                table: "EncryptedMessages",
                column: "ParentMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_EncryptedMessages_SenderId",
                table: "EncryptedMessages",
                column: "SenderId");

            migrationBuilder.CreateIndex(
                name: "IX_UserPublicKeys_UserId",
                table: "UserPublicKeys",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Reactions_EncryptedMessages_EncryptedMessageId",
                table: "Reactions",
                column: "EncryptedMessageId",
                principalTable: "EncryptedMessages",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reactions_EncryptedMessages_EncryptedMessageId",
                table: "Reactions");

            migrationBuilder.DropTable(
                name: "EncryptedAttachments");

            migrationBuilder.DropTable(
                name: "UserPublicKeys");

            migrationBuilder.DropTable(
                name: "EncryptedMessages");

            migrationBuilder.DropIndex(
                name: "IX_Reactions_EncryptedMessageId",
                table: "Reactions");

            migrationBuilder.DropColumn(
                name: "EncryptedMessageId",
                table: "Reactions");
        }
    }
}
