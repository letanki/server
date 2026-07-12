// Constantes de REGRA do clã (wiki). Ficam num módulo próprio para serem compartilhadas por
// clan.service (validações) e clan.packets (campos maxMembers/maxDescriptionLength dos modelos) sem
// criar ciclo de import (clan.service já importa clan.packets).

export const CLAN_MAX_MEMBERS = 16; // limite de membros por clã
export const CLAN_MAX_DESCRIPTION = 3000; // limite de caracteres da descrição
