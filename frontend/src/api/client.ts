import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios"
import { API_BASE_URL } from "./types"

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
    })

    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      // Attach auth token here later if needed
      return config
    })

    this.client.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        const status = err.response?.status
        if (status === 401) {
          // handle unauth
        }
        if (status === 404) {
          // not found
        }
        return Promise.reject(err)
      },
    )
  }

  get = <T = any>(path: string, config?: any) => this.client.get<T>(path, config)
  post = <T = any>(path: string, data?: any, config?: any) => this.client.post<T>(path, data, config)
  put = <T = any>(path: string, data?: any, config?: any) => this.client.put<T>(path, data, config)
  delete = <T = any>(path: string, config?: any) => this.client.delete<T>(path, config)

  // Multipart helpers
  postForm = <T = any>(path: string, formData: FormData, config?: any) =>
    this.client.post<T>(path, formData, {
      ...config,
      headers: {
        ...(config?.headers ?? {}),
        "Content-Type": undefined,
      },
    })
}

export const api = new ApiClient()
