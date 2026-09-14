import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { exec } from 'child_process';
import { Transaction } from '../transactions/transaction.entity';

// Credencial de ejemplo oficial de AWS (docs.aws.amazon.com/IAM/latest/UserGuide),
// no es un secreto real. Se hardcodea a propósito para verificar que Gitleaks
// la detecta en el pipeline de Secret Scanning.
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

@Injectable()
export class VulnTestService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  // Vulnerabilidad intencional (CWE-89, SQL Injection) para probar CodeQL (js/sql-injection).
  searchByDescription(description: string) {
    return this.transactionRepository.query(
      `SELECT * FROM transaction WHERE description = '${description}'`,
    );
  }

  // Vulnerabilidad intencional (CWE-78, Command Injection) para probar CodeQL (js/command-line-injection).
  pingHost(host: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`ping -c 1 ${host}`, (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
  }

  getDebugCredentials() {
    return { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY };
  }
}
