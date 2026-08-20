import { postFormDataRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { ApiError } from "@/core/errors/ProblemDetails";
import { Result } from "@/core/errors/Result";
import { ReportingErrorCode } from "@/core/errors/ErrorCode";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
import { UserReportRequestDTO } from "../models/UserReportRequestDTO";
import { UserReportResponseDTO } from "../models/UserReportResponseDTO";
import { BugReportRequestDTO } from "../models/BugReportRequestDTO";
import { BugReportResponseDTO } from "../models/BugReportResponseDTO";

function mapReportError(error: unknown): Result<never, ReportingErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.Conflict:
        return Result.fail(error.message, ReportingErrorCode.AlreadyReported);
      case AppErrorCode.Forbidden:
        return Result.fail(error.message, ReportingErrorCode.SelfReport);
      case AppErrorCode.TooManyRequests:
        return Result.fail(error.message, ReportingErrorCode.RateLimited);
      case AppErrorCode.BadRequest:
        return Result.fail(error.message, ReportingErrorCode.TooManyAttachments);
      case AppErrorCode.InternalError:
        return Result.fail(error.message, ReportingErrorCode.ServerError);
    }
  }
  return Result.fail("Ukjent feil.", ReportingErrorCode.Unknown);
}

export async function submitBugReport(
  payload: BugReportRequestDTO,
  appendAttachments?: (formData: FormData) => void,
): Promise<Result<BugReportResponseDTO, ReportingErrorCode>> {
  try {
    const formData = new FormData();
    formData.append("type", "1"); // SupportTicketType.BugReport
    formData.append("title", payload.title);
    formData.append("description", payload.description);
    if (payload.stepsToReproduce) formData.append("stepsToReproduce", payload.stepsToReproduce);
    if (payload.expectedBehavior) formData.append("expectedBehavior", payload.expectedBehavior);
    if (payload.actualBehavior) formData.append("actualBehavior", payload.actualBehavior);
    appendAttachments?.(formData);

    const data = await postFormDataRequest<BugReportResponseDTO>(
      ApiRoutes.support.ticket,
      formData,
    );

    return Result.ok(data!);
  } catch (error) {
    return mapReportError(error);
  }
}

export async function submitUserReport(
  payload: UserReportRequestDTO,
  appendAttachments?: (formData: FormData) => void,
): Promise<Result<UserReportResponseDTO, ReportingErrorCode>> {
  try {
    const formData = new FormData();
    formData.append("reportedUserId", payload.reportedUserId);
    formData.append("reason", payload.reason);
    formData.append("description", payload.description);
    appendAttachments?.(formData);

    const data = await postFormDataRequest<UserReportResponseDTO>(
      ApiRoutes.support.report,
      formData,
    );

    return Result.ok(data!);
  } catch (error) {
    return mapReportError(error);
  }
}
