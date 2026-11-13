## When I will want to do something with DB:
/Applications/Postgres.app/Contents/Versions/latest/bin/pg_isready -h localhost -p 5432
- Should accepting connections

/Applications/Postgres.app/Contents/Versions/latest/bin/pg_isready -h localhost -p 5432

## Tests
npx vitest run

## GIT
…or create a new repository on the command line
echo "# Cherry" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin git@github.com:Xenia-Richnakova/Cherry.git
git push -u origin main
…or push an existing repository from the command line
git remote add origin git@github.com:Xenia-Richnakova/Cherry.git
git branch -M main
git push -u origin main

## Expo
cd mobile                                          
npx expo start --web 

## DB 
Must be turned on in PostrgeSQL app

/Applications/Postgres.app/Contents/Versions/latest/bin/psql postgres://localhost/cherry -f api/db/schema.sql
/Applications/Postgres.app/Contents/Versions/latest/bin/pg_isready -h localhost -p 5432

## Starting server
DATABASE_URL=postgres://localhost/cherry npx tsx src/server.ts

## When server stops after few seconds from turning on
ps aux | grep "server.ts" | grep -v grep

kill <PID>

## How to firstly build Gradle Android app
Put all this into same terminal:

export ANDROID_HOME="/Users/book/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

npx expo run:android

## Simulate bank notification
./simulateNotifications.sh