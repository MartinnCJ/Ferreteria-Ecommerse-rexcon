param(
  [Parameter(Mandatory = $true)] [string] $WorkbookPath,
  [switch] $Apply
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv([string] $Path) {
  $result = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { continue }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim().Trim('"').Trim("'")
    $result[$name] = $value
  }
  return $result
}

function Get-ColumnNumber([string] $Reference) {
  $letters = ([regex]::Match($Reference, '^[A-Z]+')).Value
  $number = 0
  foreach ($letter in $letters.ToCharArray()) {
    $number = ($number * 26) + ([int]$letter - [int][char]'A' + 1)
  }
  return $number
}

function Read-ZipXml($Archive, [string] $Name) {
  $entry = $Archive.GetEntry($Name)
  if (-not $entry) { throw "No se encontró $Name dentro del XLSX." }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Read-WorkbookSheets([string] $Path) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $workbook = Read-ZipXml $archive 'xl/workbook.xml'
    $relationships = Read-ZipXml $archive 'xl/_rels/workbook.xml.rels'
    $sharedStrings = @()
    $sharedEntry = $archive.GetEntry('xl/sharedStrings.xml')
    if ($sharedEntry) {
      $sharedXml = Read-ZipXml $archive 'xl/sharedStrings.xml'
      foreach ($item in $sharedXml.SelectNodes("//*[local-name()='si']")) {
        $sharedStrings += (($item.SelectNodes(".//*[local-name()='t']") | ForEach-Object { $_.InnerText }) -join '')
      }
    }

    $relationshipMap = @{}
    foreach ($relationship in $relationships.SelectNodes("//*[local-name()='Relationship']")) {
      $relationshipMap[$relationship.Id] = $relationship.Target
    }

    $sheets = @{}
    foreach ($sheet in $workbook.SelectNodes("//*[local-name()='sheet']")) {
      $relationshipId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
      $target = $relationshipMap[$relationshipId].TrimStart('/')
      if ($target -notlike 'xl/*') { $target = "xl/$target" }
      $sheetXml = Read-ZipXml $archive $target
      $rawRows = $sheetXml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")
      $matrix = @()
      foreach ($rawRow in $rawRows) {
        $values = @{}
        foreach ($cell in $rawRow.SelectNodes("./*[local-name()='c']")) {
          $column = Get-ColumnNumber $cell.r
          $valueNode = $cell.SelectSingleNode("./*[local-name()='v']")
          $inlineNode = $cell.SelectSingleNode("./*[local-name()='is']")
          if ($cell.t -eq 's' -and $valueNode) {
            $value = $sharedStrings[[int]$valueNode.InnerText]
          } elseif ($cell.t -eq 'inlineStr' -and $inlineNode) {
            $value = (($inlineNode.SelectNodes(".//*[local-name()='t']") | ForEach-Object { $_.InnerText }) -join '')
          } elseif ($valueNode) {
            $value = $valueNode.InnerText
          } else {
            $value = ''
          }
          $values[$column] = $value
        }
        $matrix += ,$values
      }
      $sheets[$sheet.name] = $matrix
    }
    return $sheets
  } finally {
    $archive.Dispose()
  }
}

function Convert-SheetToObjects($Rows) {
  if ($Rows.Count -lt 2) { return @() }
  $headers = $Rows[0]
  $objects = @()
  foreach ($row in $Rows | Select-Object -Skip 1) {
    $item = [ordered]@{}
    foreach ($column in $headers.Keys) {
      $header = [string]$headers[$column]
      if (-not [string]::IsNullOrWhiteSpace($header)) {
        $item[$header] = if ($row.ContainsKey($column)) { [string]$row[$column] } else { '' }
      }
    }
    $objects += [pscustomobject]$item
  }
  return $objects
}

function Nullable-Integer($Value) {
  if ([string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  return [int][decimal]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture)
}

function Nullable-Decimal($Value) {
  if ([string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  return [decimal]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture)
}

function Invoke-Supabase([string] $Method, [string] $Path, $Body = $null, [string] $Prefer = '') {
  $headers = @{ apikey = $script:ServiceKey }
  if (-not $script:ServiceKey.StartsWith('sb_secret_')) {
    $headers.Authorization = "Bearer $script:ServiceKey"
  }
  if ($Prefer) { $headers.Prefer = $Prefer }
  $parameters = @{ Method = $Method; Uri = "$script:SupabaseUrl/rest/v1/$Path"; Headers = $headers; ContentType = 'application/json; charset=utf-8'; UserAgent = 'rexcon-server-catalog-import/1.0' }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 8 -Compress
    $parameters.Body = [Text.Encoding]::UTF8.GetBytes($json)
  }
  return Invoke-RestMethod @parameters
}

if (-not (Test-Path -LiteralPath $WorkbookPath)) { throw "No existe el archivo: $WorkbookPath" }
$sheets = Read-WorkbookSheets $WorkbookPath
$importRows = @(Convert-SheetToObjects $sheets['Supabase_Import'])
$masterRows = @(Convert-SheetToObjects $sheets['Catalogo_Maestro'])
$categoryRows = @(Convert-SheetToObjects $sheets['Categorias_Staging'])

$masterBySku = @{}
foreach ($row in $masterRows) { if ($row.SKU) { $masterBySku[$row.SKU.Trim()] = $row } }
$categoryProperty = @($masterRows[0].PSObject.Properties.Name | Where-Object { $_ -like 'Categor*' })[0]

$duplicateSkus = @($importRows | Group-Object sku | Where-Object Count -gt 1)
$duplicateSlugs = @($importRows | Group-Object slug | Where-Object Count -gt 1)
$missingSku = @($importRows | Where-Object { [string]::IsNullOrWhiteSpace($_.sku) })
$missingPrice = @($importRows | Where-Object { [string]::IsNullOrWhiteSpace($_.retail_price) })
$missingCategory = @($importRows | Where-Object { -not $masterBySku.ContainsKey($_.sku.Trim()) -or [string]::IsNullOrWhiteSpace($masterBySku[$_.sku.Trim()].$categoryProperty) })

Write-Output "Productos leídos: $($importRows.Count)"
Write-Output "Categorías leídas: $($categoryRows.Count)"
Write-Output "SKU duplicados: $($duplicateSkus.Count)"
Write-Output "Slugs duplicados: $($duplicateSlugs.Count)"
Write-Output "Productos sin SKU: $($missingSku.Count)"
Write-Output "Productos sin precio: $($missingPrice.Count)"
Write-Output "Productos sin categoría: $($missingCategory.Count)"

if ($duplicateSkus.Count -or $duplicateSlugs.Count -or $missingSku.Count -or $missingPrice.Count -or $missingCategory.Count) {
  if ($missingPrice.Count) { Write-Output ("Sin precio: " + (($missingPrice | ForEach-Object sku) -join ', ')) }
  if ($missingCategory.Count) { Write-Output ("Sin categoría: " + (($missingCategory | ForEach-Object sku) -join ', ')) }
  throw 'La validación del catálogo falló; no se realizaron cambios.'
}

if (-not $Apply) {
  Write-Output 'Validación local completada. Use -Apply para cargar en Supabase.'
  exit 0
}

$environment = Read-DotEnv (Join-Path $PSScriptRoot '..\.env')
$script:SupabaseUrl = $environment.SUPABASE_URL.TrimEnd('/')
$script:ServiceKey = $environment.SUPABASE_SERVICE_ROLE_KEY
if (-not $script:SupabaseUrl -or -not $script:ServiceKey) { throw 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.' }

$existingProducts = Invoke-Supabase 'GET' 'products?select=sku,status,physical_stock,reserved_stock,blister_stock,master_box_stock&limit=10000'
$existingBySku = @{}
foreach ($row in $existingProducts) { $existingBySku[$row.sku] = $row }

$categories = @()
foreach ($row in $categoryRows) {
  $categories += [ordered]@{
    name = $row.name.Trim()
    slug = $row.slug.Trim()
    active = $row.active -eq '1'
    sort_order = [int]$row.sort_order
  }
}
for ($offset = 0; $offset -lt $categories.Count; $offset += 100) {
  $last = [Math]::Min($offset + 99, $categories.Count - 1)
  Invoke-Supabase 'POST' 'categories?on_conflict=slug' @($categories[$offset..$last]) 'resolution=merge-duplicates,return=minimal' | Out-Null
}

$remoteCategories = Invoke-Supabase 'GET' 'categories?select=id,name,slug&limit=1000'
$remoteCategoryBySlug = @{}
foreach ($category in $remoteCategories) { $remoteCategoryBySlug[$category.slug] = $category }
$categoryIdByName = @{}
foreach ($category in $categoryRows) {
  $remoteCategory = $remoteCategoryBySlug[$category.slug.Trim()]
  if ($remoteCategory) {
    $categoryIdByName[$category.name.Trim().ToLowerInvariant()] = $remoteCategory.id
    if (-not [string]::IsNullOrWhiteSpace($category.parent_name)) {
      $fullName = ($category.parent_name.Trim() + ' / ' + $category.name.Trim()).ToLowerInvariant()
      $categoryIdByName[$fullName] = $remoteCategory.id
    }
  }
}
Write-Output "Categorías remotas: $($remoteCategories.Count); asociaciones: $($categoryIdByName.Count)"

$products = @()
foreach ($row in $importRows) {
  $sku = $row.sku.Trim()
  $categoryName = $masterBySku[$sku].$categoryProperty.Trim().ToLowerInvariant()
  if (-not $categoryIdByName.ContainsKey($categoryName)) { throw "No se creó/encontró la categoría '$categoryName' de $sku." }
  $existing = $existingBySku[$sku]
  $physicalStock = if ($existing) { [int]$existing.physical_stock } else { [int]$row.physical_stock }
  $reservedStock = if ($existing) { [int]$existing.reserved_stock } else { [int]$row.reserved_stock }
  $product = [ordered]@{
    sku = $sku
    slug = $row.slug.Trim()
    name = $row.name.Trim()
    short_name = if ($row.short_name) { $row.short_name.Trim() } else { $null }
    short_description = if ($row.short_description) { $row.short_description.Trim() } else { $null }
    description = if ($row.description) { $row.description.Trim() } else { $null }
    category_id = $categoryIdByName[$categoryName]
    brand = $row.brand.Trim()
    status = 'active'
    featured = $row.featured -eq '1'
    icon = if ($row.icon) { $row.icon.Trim() } else { $null }
    accent = if ($row.accent) { $row.accent.Trim() } else { $null }
    retail_price = Nullable-Integer $row.retail_price
    professional_price = Nullable-Integer $row.professional_price
    wholesale_price = Nullable-Integer $row.wholesale_price
    distributor_price = Nullable-Integer $row.distributor_price
    cost = Nullable-Integer $row.cost
    physical_stock = $physicalStock
    blister_stock = if ($existing) { [int]$existing.blister_stock } else { 0 }
    master_box_stock = if ($existing) { [int]$existing.master_box_stock } else { 0 }
    reserved_stock = $reservedStock
    minimum_stock = [int]$row.minimum_stock
    weight = Nullable-Decimal $row.weight
    width = Nullable-Decimal $row.width
    height = Nullable-Decimal $row.height
    length = Nullable-Decimal $row.length
    warranty_months = [int]$row.warranty_months
  }
  $products += $product
}

for ($offset = 0; $offset -lt $products.Count; $offset += 100) {
  $last = [Math]::Min($offset + 99, $products.Count - 1)
  Invoke-Supabase 'POST' 'products?on_conflict=sku' @($products[$offset..$last]) 'resolution=merge-duplicates,return=minimal' | Out-Null
  Write-Output "Productos cargados: $($last + 1)/$($products.Count)"
}

$total = (Invoke-Supabase 'GET' 'products?select=id&limit=10000').Count
$visible = (Invoke-Supabase 'GET' 'products_public?select=id&limit=10000').Count
Write-Output "Carga completa. Productos totales en Supabase: $total; visibles en catálogo: $visible."
