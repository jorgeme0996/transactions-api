import { Controller, Get, Query } from '@nestjs/common';
import { VulnTestService } from './vuln-test.service';

// Controlador de prueba: expone endpoints con vulnerabilidades intencionales
// (SQLi, command injection, secreto hardcodeado) para validar de punta a punta
// el pipeline de seguridad (CodeQL + Gitleaks + SCA/EPSS + risk-engine).
// NO mergear este módulo a main.
@Controller('vuln-test')
export class VulnTestController {
  constructor(private readonly vulnTestService: VulnTestService) {}

  @Get('search')
  search(@Query('description') description: string) {
    return this.vulnTestService.searchByDescription(description);
  }

  @Get('ping')
  ping(@Query('host') host: string) {
    return this.vulnTestService.pingHost(host);
  }

  @Get('debug-credentials')
  debugCredentials() {
    return this.vulnTestService.getDebugCredentials();
  }
}
