@echo off
REM ใช้ path เต็มของ mysql (MySQL Server 9.5)
set MYSQL_BIN="C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe"
set DB=warehouse_shelf
set PROJECT=c:\Users\mos\Documents\warehouse-shelf-system

echo สร้าง database...
%MYSQL_BIN% -u root -p -e "CREATE DATABASE IF NOT EXISTS %DB%;"

echo รัน schema.sql...
%MYSQL_BIN% -u root -p %DB% < "%PROJECT%\database\schema.sql"

echo รัน seed.sql...
%MYSQL_BIN% -u root -p %DB% < "%PROJECT%\database\seed.sql"

echo เสร็จแล้ว. ต่อไปรัน: cd backend ^&^& npm run import-orders
pause
