using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class GjortOmMasse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupNotifications");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_ConversationId",
                table: "MessageNotifications");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_UserId",
                table: "MessageNotifications");

            migrationBuilder.AddColumn<int>(
                name: "EventCount",
                table: "MessageNotifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupEventIdsJson",
                table: "MessageNotifications",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "MessageNotifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotifications_ConversationId_Type_IsRead",
                table: "MessageNotifications",
                columns: new[] { "ConversationId", "Type", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotifications_UserId_ConversationId_Type_IsRead",
                table: "MessageNotifications",
                columns: new[] { "UserId", "ConversationId", "Type", "IsRead" },
                unique: true,
                filter: "\"Type\" = 8 AND \"IsRead\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotifications_UserId_Type_IsRead_LastUpdatedAt",
                table: "MessageNotifications",
                columns: new[] { "UserId", "Type", "IsRead", "LastUpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_ConversationId_Type_IsRead",
                table: "MessageNotifications");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_UserId_ConversationId_Type_IsRead",
                table: "MessageNotifications");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_UserId_Type_IsRead_LastUpdatedAt",
                table: "MessageNotifications");

            migrationBuilder.DropColumn(
                name: "EventCount",
                table: "MessageNotifications");

            migrationBuilder.DropColumn(
                name: "GroupEventIdsJson",
                table: "MessageNotifications");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "MessageNotifications");

            migrationBuilder.CreateTable(
                name: "GroupNotifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EventCount = table.Column<int>(type: "integer", nullable: false),
                    GroupEventIdsJson = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupNotifications_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupNotifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotifications_ConversationId",
                table: "MessageNotifications",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotifications_UserId",
                table: "MessageNotifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupNotifications_ConversationId",
                table: "GroupNotifications",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupNotifications_UserId_ConversationId_IsRead",
                table: "GroupNotifications",
                columns: new[] { "UserId", "ConversationId", "IsRead" },
                unique: true,
                filter: "\"IsRead\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_GroupNotifications_UserId_IsRead_LastUpdatedAt",
                table: "GroupNotifications",
                columns: new[] { "UserId", "IsRead", "LastUpdatedAt" });
        }
    }
}
