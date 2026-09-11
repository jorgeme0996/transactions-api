import { BadRequestException } from "@nestjs/common";
import { TransactionRequestDTO, TransactionType } from "../dto/transactions.dto";

export const validateTransactionRules = (transactionRequestDto: TransactionRequestDTO) => {
  /* 
    TODO: Una tabla donde se presenten las currencies y las 
    que son aceptadas y las que no para no tenerla hardcodeada
  */
 const { amount, type } = transactionRequestDto
  if (transactionRequestDto.currency.trim().toLocaleLowerCase() !== 'mxn') {
    throw new BadRequestException('Currency not accepted');
  }
  if (amount <= 1 || type === TransactionType.DEBIT && amount < 10000) { 
    throw new BadRequestException('Not valid amount');
  }
}