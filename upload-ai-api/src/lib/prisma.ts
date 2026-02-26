import { PrismaClient } from "@prisma/client";

// responsável pela conexão com o banco de dados
export const prisma = new PrismaClient()