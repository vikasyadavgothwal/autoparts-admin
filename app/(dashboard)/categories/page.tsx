import { fetchCategories } from "@/actions/admin-dashboard/categories/categories"
import { CategoriesPage } from "@/components/admin-dashboard/categories/categories-page"

type CategoriesPageSearchParams = Promise<{
  q?: string | string[]
  page?: string | string[]
}>

const getSingleParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? ""

export default async function CategoriesRoutePage({
  searchParams,
}: {
  searchParams: CategoriesPageSearchParams
}) {
  const params = await searchParams
  const parsedPage = Number.parseInt(getSingleParam(params.page), 10)
  const result = await fetchCategories({
    query: getSingleParam(params.q),
    page: Number.isNaN(parsedPage) ? 1 : parsedPage,
  })

  return <CategoriesPage key={`${result.query}-${result.pagination.page}`} result={result} />
}
