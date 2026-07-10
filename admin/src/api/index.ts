import axios from 'axios'

const baseURL = import.meta.env.PROD ? '' : ''

export const api = axios.create({
    baseURL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
})
