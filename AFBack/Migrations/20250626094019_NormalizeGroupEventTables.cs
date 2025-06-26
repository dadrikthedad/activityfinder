using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeGroupEventTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_UserId_ConversationId_Type_IsRead",
                table: "MessageNotifications");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_UserId_Type_IsRead_LastUpdatedAt",
                table: "MessageNotifications");

            migrationBuilder.DropColumn(
                name: "GroupEventIdsJson",
                table: "MessageNotifications");

            migrationBuilder.DropColumn(
                name: "AffectedUserIdsJson",
                table: "GroupEvents");

            migrationBuilder.CreateTable(
                name: "GroupEventAffectedUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GroupEventId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupEventAffectedUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupEventAffectedUsers_GroupEvents_GroupEventId",
                        column: x => x.GroupEventId,
                        principalTable: "GroupEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupEventAffectedUsers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MessageNotificationGroupEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageNotificationId = table.Column<int>(type: "integer", nullable: false),
                    GroupEventId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageNotificationGroupEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageNotificationGroupEvents_GroupEvents_GroupEventId",
                        column: x => x.GroupEventId,
                        principalTable: "GroupEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MessageNotificationGroupEvents_MessageNotifications_Message~",
                        column: x => x.MessageNotificationId,
                        principalTable: "MessageNotifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotification_UniqueGroupEvent",
                table: "MessageNotifications",
                columns: new[] { "UserId", "ConversationId", "Type", "IsRead" },
                filter: "\"Type\" = 8 AND \"IsRead\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotifications_UserId_Type_IsRead",
                table: "MessageNotifications",
                columns: new[] { "UserId", "Type", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_GroupEventAffectedUser_GroupEventId",
                table: "GroupEventAffectedUsers",
                column: "GroupEventId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupEventAffectedUser_GroupEventId_UserId",
                table: "GroupEventAffectedUsers",
                columns: new[] { "GroupEventId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupEventAffectedUser_UserId",
                table: "GroupEventAffectedUsers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotificationGroupEvent_EventId",
                table: "MessageNotificationGroupEvents",
                column: "GroupEventId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotificationGroupEvent_NotificationId",
                table: "MessageNotificationGroupEvents",
                column: "MessageNotificationId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageNotificationGroupEvent_NotificationId_EventId",
                table: "MessageNotificationGroupEvents",
                columns: new[] { "MessageNotificationId", "GroupEventId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupEventAffectedUsers");

            migrationBuilder.DropTable(
                name: "MessageNotificationGroupEvents");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotification_UniqueGroupEvent",
                table: "MessageNotifications");

            migrationBuilder.DropIndex(
                name: "IX_MessageNotifications_UserId_Type_IsRead",
                table: "MessageNotifications");

            migrationBuilder.AddColumn<string>(
                name: "GroupEventIdsJson",
                table: "MessageNotifications",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AffectedUserIdsJson",
                table: "GroupEvents",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

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
    }
}
