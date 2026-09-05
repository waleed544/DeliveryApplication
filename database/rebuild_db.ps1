$ErrorActionPreference = 'Stop'

$pg = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$database = "delivery_platform"
$env:PGPASSWORD = "waleed544"
$env:PGCLIENTENCODING = "UTF8"

Write-Host "Closing active connections to $database..."
& $pg --set=ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid();"

Write-Host "Dropping database $database..."
& $pg --set=ON_ERROR_STOP=1 -U postgres -d postgres -c "DROP DATABASE IF EXISTS $database;"

Write-Host "Creating database $database..."
& $pg --set=ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $database;"

Write-Host "Applying schema..."
& $pg --set=ON_ERROR_STOP=1 -U postgres -d $database -f "$PSScriptRoot\schema.sql"

Write-Host "Database rebuild complete."
