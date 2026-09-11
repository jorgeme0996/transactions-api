import { TransactionType } from "src/transactions/dto/transactions.dto";

export enum StatusType {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED"
}

export enum CodeType {
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  REJECTED = "MISSING_API_KEY",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  CURRENCY_MISMATCH = "CURRENCY_MISMATCH",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
}

export interface ProviderRequestDto {
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
}

export interface ProviderResponseDto {
  transactionId: string;
  status: StatusType.APPROVED;
  balance: number;
  executedAt: Date;
}

export interface ProviderResponseErrorDto {
  status: StatusType.REJECTED,
  code: string,
  message: string
}
