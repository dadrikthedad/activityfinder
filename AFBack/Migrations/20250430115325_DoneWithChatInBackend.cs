using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class DoneWithChatInBackend : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageBlocks_Users_BlockedUserId",
                table: "MessageBlocks");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageRequests_Users_SenderId",
                table: "MessageRequests");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Reactions",
                table: "Reactions");

            migrationBuilder.DropIndex(
                name: "IX_Reactions_MessageId",
                table: "Reactions");

            migrationBuilder.DropIndex(
                name: "IX_ConversationReadStates_UserId",
                table: "ConversationReadStates");

            migrationBuilder.Sql(
                @"ALTER TABLE ""Reactions""
      ALTER COLUMN ""UserId"" TYPE integer USING ""UserId""::integer;");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Reactions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<int>(
                name: "ParentMessageId",
                table: "Messages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Reactions",
                table: "Reactions",
                columns: new[] { "MessageId", "UserId" });

            migrationBuilder.CreateTable(
                name: "GroupBlocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    BlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupBlocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupBlocks_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupBlocks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GroupInviteRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    InviterId = table.Column<int>(type: "integer", nullable: false),
                    InvitedUserId = table.Column<int>(type: "integer", nullable: false),
                    IsAccepted = table.Column<bool>(type: "boolean", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupInviteRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupInviteRequests_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupInviteRequests_Users_InvitedUserId",
                        column: x => x.InvitedUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupInviteRequests_Users_InviterId",
                        column: x => x.InviterId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reactions_UserId",
                table: "Reactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ParentMessageId",
                table: "Messages",
                column: "ParentMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationReadStates_UserId_ConversationId",
                table: "ConversationReadStates",
                columns: new[] { "UserId", "ConversationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupBlocks_ConversationId",
                table: "GroupBlocks",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupBlocks_UserId_ConversationId",
                table: "GroupBlocks",
                columns: new[] { "UserId", "ConversationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupInviteRequests_ConversationId_InvitedUserId",
                table: "GroupInviteRequests",
                columns: new[] { "ConversationId", "InvitedUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupInviteRequests_InvitedUserId",
                table: "GroupInviteRequests",
                column: "InvitedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupInviteRequests_InviterId",
                table: "GroupInviteRequests",
                column: "InviterId");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageBlocks_Users_BlockedUserId",
                table: "MessageBlocks",
                column: "BlockedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRequests_Users_SenderId",
                table: "MessageRequests",
                column: "SenderId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Messages_ParentMessageId",
                table: "Messages",
                column: "ParentMessageId",
                principalTable: "Messages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reactions_Users_UserId",
                table: "Reactions",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageBlocks_Users_BlockedUserId",
                table: "MessageBlocks");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageRequests_Users_SenderId",
                table: "MessageRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Messages_ParentMessageId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Reactions_Users_UserId",
                table: "Reactions");

            migrationBuilder.DropTable(
                name: "GroupBlocks");

            migrationBuilder.DropTable(
                name: "GroupInviteRequests");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Reactions",
                table: "Reactions");

            migrationBuilder.DropIndex(
                name: "IX_Reactions_UserId",
                table: "Reactions");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ParentMessageId",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_ConversationReadStates_UserId_ConversationId",
                table: "ConversationReadStates");

            migrationBuilder.DropColumn(
                name: "ParentMessageId",
                table: "Messages");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Reactions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                table: "Reactions",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Reactions",
                table: "Reactions",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_Reactions_MessageId",
                table: "Reactions",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationReadStates_UserId",
                table: "ConversationReadStates",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageBlocks_Users_BlockedUserId",
                table: "MessageBlocks",
                column: "BlockedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRequests_Users_SenderId",
                table: "MessageRequests",
                column: "SenderId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
