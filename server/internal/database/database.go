package database

import (
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func Open(dsn string) (*gorm.DB, error) {
	var lastErr error

	for i := 0; i < 30; i++ {
		db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
		if err == nil {
			sqlDB, pingErr := db.DB()
			if pingErr == nil {
				if pingErr = sqlDB.Ping(); pingErr == nil {
					return db, nil
				}
			}
			lastErr = pingErr
		} else {
			lastErr = err
		}

		time.Sleep(2 * time.Second)
	}

	return nil, lastErr
}
