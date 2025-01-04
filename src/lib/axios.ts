import axios from "axios"

export const api = axios.create({
    baseURL: 'http://localhost:3333', // endereço em que o back-end está rodando
})