package auth

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"size:64;not null" json:"username"`
	Account      string    `gorm:"size:64;uniqueIndex;not null" json:"account"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type UserDTO struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Account  string `json:"account"`
}

func ToUserDTO(user User) UserDTO {
	return UserDTO{
		ID:       user.ID,
		Username: user.Username,
		Account:  user.Account,
	}
}
