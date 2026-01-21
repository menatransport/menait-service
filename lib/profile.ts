
import { useEffect } from 'react';

interface User {
    id: Number,
    username: String,
    firstname: String,
    lastname: String,
    employee_id: String,
    site: String,
    department: String,
    position: String,
    position_level: String,
    position_level_id: Number,
}

export const UserProfile = () => {
    let user = null;
    useEffect(() => {
       
            user = JSON.parse(localStorage.getItem('user') || 'null');
        
    }, []); 

    return user;
}