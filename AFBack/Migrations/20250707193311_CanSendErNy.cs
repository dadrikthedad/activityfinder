using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class CanSendErNy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CanSend",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Reason = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ConversationId1 = table.Column<int>(type: "integer", nullable: true),
                    UserId1 = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CanSend", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CanSend_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CanSend_Conversations_ConversationId1",
                        column: x => x.ConversationId1,
                        principalTable: "Conversations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CanSend_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CanSend_Users_UserId1",
                        column: x => x.UserId1,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_CanSend_ConversationId",
                table: "CanSend",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_CanSend_ConversationId1",
                table: "CanSend",
                column: "ConversationId1");

            migrationBuilder.CreateIndex(
                name: "IX_CanSend_LastUpdated",
                table: "CanSend",
                column: "LastUpdated");

            migrationBuilder.CreateIndex(
                name: "IX_CanSend_UserId_ConversationId",
                table: "CanSend",
                columns: new[] { "UserId", "ConversationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CanSend_UserId1",
                table: "CanSend",
                column: "UserId1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CanSend");
        }
    }
}
