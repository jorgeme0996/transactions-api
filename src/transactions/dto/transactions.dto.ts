import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { StatusType } from 'src/provider/dto/provider.dto';

export enum TransactionType {
  CREDIT = "CREDIT",
  DEBIT = "DEBIT"
}

export class TransactionRequestDTO {
  @IsNotEmpty()
  @IsString()
  accountId: string;

  
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsNotEmpty()
  @IsString()
  description: string;
}

export class TransactionsQueryDTO {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(StatusType)
  status?: StatusType;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
