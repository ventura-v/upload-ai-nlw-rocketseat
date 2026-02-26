import { FastifyInstance } from "fastify";
import { prisma } from '../lib/prisma'

// o fastify exige que todos os módulos/rotas cadastrados usando o método register (em src/server.ts) sejam assíncronos
// se não usar o async, o servidor não roda
export async function getAllPromptsRoute(app: FastifyInstance) {
    app.get('/prompts', async () => {
        const prompts = await prisma.prompt.findMany()

        return prompts
    })
}