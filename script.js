// =========================================================
// ⚠️ GANTI 'YOUR_API_KEY' DENGAN KUNCI API ANDA YANG SEBENARNYA
// =========================================================
const apiKey = "2e964c7c31839626e6993bf684cbd9f5"; // Ganti dengan kunci API Anda yang sebenarnya!

// Ikon khusus untuk menandai lokasi pengguna (marker merah)
// Ikon ini tetap dimuat dari internet untuk kesederhanaan visual, namun shadow-nya lokal.
const myLocationIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'images/marker-shadow.png', 
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});


const indonesianCities = [
    "Banda Aceh,ID", "Medan,ID", "Padang,ID", "Pekanbaru,ID", "Jambi,ID", 
    "Palembang,ID", "Bengkulu,ID", "Pangkal Pinang,ID", "Tanjung Pinang,ID", 
    "Bandar Lampung,ID", "Serang,ID", "Jakarta,ID", "Bandung,ID", 
    "Semarang,ID", "Yogyakarta,ID", "Surabaya,ID", "Denpasar,ID", 
    "Mataram,ID", "Kupang,ID", "Pontianak,ID", "Palangkaraya,ID", 
    "Banjarmasin,ID", "Samarinda,ID", "Tanjung Selor,ID", "Manado,ID", 
    "Palu,ID", "Makassar,ID", "Kendari,ID", "Gorontalo,ID", "Mamuju,ID", 
    "Ambon,ID", "Ternate,ID", "Jayapura,ID", "Manokwari,ID", "Merauke,ID", 
    "Nabire,ID", "Wamena,ID", "Sorong,ID"
];

const weatherTableBody = document.getElementById("weather-table-body");
const loadingMessage = document.getElementById("loading-message");
const lastUpdatedDisplay = document.getElementById("last-updated"); 
const dailySummaryContainer = document.getElementById("daily-summary-container");
const hourlyDetailContainer = document.getElementById("hourly-detail-container");
const detailHeader = document.getElementById("detail-header");

let allWeatherData = []; 
let map = null; 
let rawForecastData = null; 
let currentSortColumn = null;
let isAscending = true; 


// =========================================================
// 1. FUNGSI UTAMA PENGAMBILAN DATA (38 KOTA)
// =========================================================
function fetchAllWeather() {
    loadingMessage.style.display = 'block';
    weatherTableBody.innerHTML = ''; 
    allWeatherData = []; 
    dailySummaryContainer.innerHTML = '<p id="daily-forecast-message" style="width: 100%; text-align: center; color: #777; padding-bottom: 15px;">Pilih kota atau lokasi Anda untuk melihat prediksi 5 hari.</p>';
    hourlyDetailContainer.innerHTML = '';
    detailHeader.style.display = 'none';

    if (map === null) {
        map = L.map('map').setView([0.7893, 113.9213], 5); 
        
        // --- PERUBAHAN TILE LAYER (PETA SATELIT) ---
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(map);
        // -------------------------------------------

        map.whenReady(function() {
            map.invalidateSize(); 
        });
    } else {
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        map.setView([0.7893, 113.9213], 5);
        map.invalidateSize();
    }

    const requests = indonesianCities.map(city => getWeatherData(city));

    Promise.allSettled(requests)
        .then(results => {
            loadingMessage.style.display = 'none'; 
            
            const successfulResult = results.find(r => r.status === 'fulfilled');
            if (successfulResult) {
                convertTimestamp(successfulResult.value.dt); 
            }

            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const data = result.value;
                    allWeatherData.push(data); 
                    displayWeatherRow(data);
                    addMarkerToMap(data); 
                } else {
                    let cityWithError = result.reason.message.split('Gagal mengambil data untuk ')[1] || 'Kota Tak Dikenal';
                    displayErrorRow(cityWithError);
                }
            });
            
            addSortingListeners(); 

        })
        .catch(error => {
            console.error("Terjadi error saat mengambil semua data:", error);
            lastUpdatedDisplay.textContent = ""; 
            loadingMessage.textContent = "Gagal memuat data cuaca. Cek koneksi atau API Key Anda.";
        });
}


// =========================================================
// 2. FUNGSI PENCARIAN KOTA DAN LOKASI SAYA
// =========================================================
function searchCityWeather() {
    const cityInput = document.getElementById('city-input').value.trim();
    if (!cityInput) {
        alert("Mohon masukkan nama kota!");
        return;
    }

    loadingMessage.style.display = 'block';
    weatherTableBody.innerHTML = ''; 
    
    getCityCoordinates(cityInput)
        .then(coords => {
            return getWeatherByCoords(coords);
        })
        .then(data => {
            loadingMessage.style.display = 'none';
            data.current.name = data.current.name || coords.name;
            
            displaySearchResult(data.current); 
            displayDailySummary(data.dailyForecast); 
            displayHourlyDetails(rawForecastData);
        })
        .catch(error => {
            loadingMessage.style.display = 'none';
            alert(`Gagal menemukan data cuaca untuk "${cityInput}". Pesan: ${error.message}`);
            console.error(error);
        });
}

function getMyLocationWeather() {
    loadingMessage.style.display = 'block';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                getWeatherByCoords({ lat, lon })
                    .then(data => {
                        loadingMessage.style.display = 'none';
                        data.current.name = 'Lokasi Saya Saat Ini (' + data.current.name + ')';
                        
                        displaySearchResult(data.current); 
                        displayDailySummary(data.dailyForecast); 
                        displayHourlyDetails(rawForecastData);
                    })
                    .catch(error => {
                        loadingMessage.style.display = 'none';
                        alert("Gagal mengambil data cuaca untuk lokasi Anda.");
                        console.error("Error Weather By Coords:", error);
                    });
            },
            (error) => {
                loadingMessage.style.display = 'none';
                let errorMessage = "Gagal mendeteksi lokasi: ";
                if (error.code === error.PERMISSION_DENIED) {
                    errorMessage += "Akses ditolak oleh pengguna.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errorMessage += "Informasi lokasi tidak tersedia.";
                } else {
                    errorMessage += error.message;
                }
                alert(errorMessage + " (Pastikan Geolocation diizinkan di browser Anda)");
                console.error("Error Geolocation:", error);
            }
        );
    } else {
        loadingMessage.style.display = 'none';
        alert("Browser Anda tidak mendukung Geolocation.");
    }
}


function displaySearchResult(data) {
    map.setView([data.coord.lat, data.coord.lon], 9); 
    map.invalidateSize();
    
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    weatherTableBody.innerHTML = ''; 
    displayWeatherRow(data);
    convertTimestamp(data.dt);
    
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    const cityName = data.name;
    const temp = data.main.temp.toFixed(1);
    const description = data.weather[0].description;
    
    const popupContent = `
        <strong>${cityName}</strong><br>
        Suhu: ${temp}°C<br>
        Kondisi: ${description.charAt(0).toUpperCase() + description.slice(1)}
    `;
    
    let iconToUse = null;
    if (cityName.includes('Lokasi Saya Saat Ini')) {
        iconToUse = myLocationIcon; 
    } else {
        const iconCode = data.weather[0].icon;
        // --- MENGGUNAKAN IKON LOKAL (@2x untuk marker) ---
        const iconUrl = `images/${iconCode}@2x.png`;
        // ------------------------------------------------
        iconToUse = L.icon({
            iconUrl: iconUrl,
            iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -25] 
        });
    }

    L.marker([lat, lon], {icon: iconToUse}) 
        .addTo(map)
        .bindPopup(popupContent)
        .openPopup(); 

    const row = weatherTableBody.querySelector('tr');
    if (row) {
        row.style.backgroundColor = '#ffffcc'; 
        row.style.fontWeight = 'bold';
    }
}


// =========================================================
// 3. FUNGSI UTILITAS API DAN TAMPILAN
// =========================================================

function getCityCoordinates(city) {
    const geoApiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
    
    return fetch(geoApiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error("Gagal terhubung ke Geocoding API.");
            }
            return response.json();
        })
        .then(data => {
            if (data.length === 0) {
                throw new Error(`Tidak menemukan koordinat untuk: ${city}`);
            }
            return { lat: data[0].lat, lon: data[0].lon, name: data[0].name };
        });
}

function getWeatherByCoords({ lat, lon }) {
    const currentApiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const forecastApiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    return Promise.all([
        fetch(currentApiUrl).then(res => res.json()),
        fetch(forecastApiUrl).then(res => res.json())
    ])
    .then(([currentData, forecastData]) => {
        if (currentData.cod !== 200 || forecastData.cod !== '200') {
            throw new Error("Gagal mengambil data cuaca dari API.");
        }
        
        rawForecastData = forecastData.list; 
        
        const dailySummary = summarizeForecast(forecastData.list);

        return {
            current: currentData,
            dailyForecast: dailySummary
        };
    });
}

function summarizeForecast(forecastList) {
    const dailyData = {};
    
    forecastList.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        const today = new Date().toISOString().split('T')[0];
        if (date === today) return;

        if (!dailyData[date]) {
            dailyData[date] = {
                temp_min: Infinity,
                temp_max: -Infinity,
                weather: item.weather[0],
                targetTime: '12:00:00' 
            };
        }
        
        dailyData[date].temp_min = Math.min(dailyData[date].temp_min, item.main.temp_min);
        dailyData[date].temp_max = Math.max(dailyData[date].temp_max, item.main.temp_max);
        
        if (item.dt_txt.includes(dailyData[date].targetTime)) {
             dailyData[date].weather = item.weather[0];
        }
    });

    const days = Object.keys(dailyData).sort();
    const summaryArray = days.slice(0, 5).map(dateKey => {
        const data = dailyData[dateKey];
        return {
            date: dateKey,
            temp_min: data.temp_min.toFixed(1),
            temp_max: data.temp_max.toFixed(1),
            icon: data.weather.icon,
            description: data.weather.description
        };
    });
    
    return summaryArray;
}


function getWeatherData(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
    
    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Gagal mengambil data untuk ${city}`);
            }
            return response.json();
        });
}


function convertTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const options = { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short'
    };
    const formattedTime = date.toLocaleTimeString('id-ID', options);
    lastUpdatedDisplay.textContent = `Data terakhir diperbarui pada: ${formattedTime}`;
}


function addMarkerToMap(data) {
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    const cityName = data.name;
    const temp = data.main.temp.toFixed(1);
    const description = data.weather[0].description;
    const iconCode = data.weather[0].icon;
    
    // --- MENGGUNAKAN IKON LOKAL (@2x untuk marker) ---
    const iconUrl = `images/${iconCode}@2x.png`;
    // ------------------------------------------------
    
    const weatherIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -25] 
    });

    const popupContent = `
        <strong>${cityName}</strong><br>
        Suhu: ${temp}°C<br>
        Kondisi: ${description.charAt(0).toUpperCase() + description.slice(1)}
    `;

    L.marker([lat, lon], {icon: weatherIcon}) 
        .addTo(map)
        .bindPopup(popupContent); 
}

function displayWeatherRow(data) {
    const cityName = data.name;
    const temp = data.main.temp.toFixed(1); 
    const description = data.weather[0].description;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed.toFixed(1);
    const iconCode = data.weather[0].icon;
    
    // --- MENGGUNAKAN IKON LOKAL (@2x untuk tabel) ---
    const iconUrl = `images/${iconCode}@2x.png`;
    // ------------------------------------------------
    
    const rain1h = data.rain && data.rain['1h'] ? data.rain['1h'].toFixed(1) : '0.0';

    const row = weatherTableBody.insertRow();
    
    row.insertCell().textContent = cityName; 
    row.insertCell().innerHTML = `<strong>${temp}°C</strong>`; 
    row.insertCell().textContent = description.charAt(0).toUpperCase() + description.slice(1);
    
    row.insertCell().innerHTML = `<img src="${iconUrl}" alt="${description}" style="width: 50px; height: 50px; display: block; margin: auto;">`;
    
    row.insertCell().textContent = `${humidity}%`;
    row.insertCell().textContent = `${windSpeed} m/s`;
    
    row.insertCell().textContent = `${rain1h} mm`; 
}

function displayErrorRow(city) {
    const row = weatherTableBody.insertRow();
    row.insertCell().textContent = city.replace(',ID', '');
    row.insertCell().colSpan = 7; 
    row.cells[1].innerHTML = `<span style="color: red; font-style: italic;">Data tidak ditemukan/Error API.</span>`;
}


function displayDailySummary(dailyData) {
    dailySummaryContainer.innerHTML = '';
    
    const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    if (dailyData.length === 0) {
         dailySummaryContainer.innerHTML = '<p id="daily-forecast-message" style="width: 100%; text-align: center; color: #777;">Tidak ada data prediksi harian yang tersedia.</p>';
         return;
    }

    dailyData.forEach((dayData, index) => {
        const date = new Date(dayData.date);
        const dayName = daysOfWeek[date.getDay()];
        const iconCode = dayData.icon;
        
        // --- MENGGUNAKAN IKON LOKAL (@2x untuk ringkasan) ---
        const iconUrl = `images/${iconCode}@2x.png`;
        // --------------------------------------------------
        
        const description = dayData.description.charAt(0).toUpperCase() + dayData.description.slice(1);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <strong>${index === 0 ? 'BESOK' : dayName}</strong>
            <p style="font-size: 0.8em; margin: 5px 0;">${date.getDate()}/${date.getMonth() + 1}</p>
            <img src="${iconUrl}" alt="${description}" style="width: 60px; height: 60px; display: block; margin: -10px auto;">
            <p style="font-weight: bold; margin: 5px 0;">
                ${dayData.temp_max}°C / ${dayData.temp_min}°C
            </p>
            <small>${description}</small>
        `;
        dailySummaryContainer.appendChild(card);
    });
}


function displayHourlyDetails(forecastList) {
    hourlyDetailContainer.innerHTML = '';
    detailHeader.style.display = 'block';

    const today = new Date().toISOString().split('T')[0];
    
    const filteredList = forecastList.filter(item => {
        const date = item.dt_txt.split(' ')[0];
        return date !== today; 
    }).slice(0, 40); 

    if (filteredList.length === 0) {
        hourlyDetailContainer.innerHTML = '<p style="text-align: center;">Tidak ada detail prediksi per jam yang tersedia.</p>';
        detailHeader.style.display = 'none';
        return;
    }

    let currentDay = '';
    
    filteredList.forEach(item => {
        const dateTime = new Date(item.dt * 1000);
        const dateStr = dateTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
        const timeStr = dateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        const temp = item.main.temp.toFixed(1);
        const description = item.weather[0].description.charAt(0).toUpperCase() + item.weather[0].description.slice(1);
        const iconCode = item.weather[0].icon;
        
        // --- MENGGUNAKAN IKON LOKAL (@2x untuk detail per 3 jam) ---
        const iconUrl = `images/${iconCode}@2x.png`; 
        // ----------------------------------------------------------
        
        const rain3h = item.rain && item.rain['3h'] ? item.rain['3h'].toFixed(1) : '0.0'; 

        if (dateStr !== currentDay) {
            currentDay = dateStr;
            const header = document.createElement('h4');
            header.textContent = currentDay;
            header.style.cssText = 'margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #555; width: 100%;';
            hourlyDetailContainer.appendChild(header);
        }

        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <div style="font-weight: bold; color: #007bff;">${timeStr}</div>
            <img src="${iconUrl}" alt="${description}" style="width: 40px; height: 40px;">
            <div>${temp}°C</div>
            <div style="font-size: 0.85em;">${description}</div>
            <div style="font-size: 0.8em; color: ${rain3h > 0 ? 'red' : '#333'};">Hujan: ${rain3h} mm</div>
        `;
        hourlyDetailContainer.appendChild(card);
    });
}


// =========================================================
// 4. FUNGSI SORTING
// =========================================================
function sortTable(columnName, isNumeric) {
    if (currentSortColumn === columnName) {
        isAscending = !isAscending; 
    } else {
        currentSortColumn = columnName;
        isAscending = true; 
    }

    allWeatherData.sort((a, b) => {
        let valA, valB;

        if (columnName === 'name') {
            valA = a.name.toUpperCase();
            valB = b.name.toUpperCase();
        } else if (columnName === 'temp') {
            valA = a.main.temp;
            valB = b.main.temp;
        } else if (columnName === 'humidity') {
            valA = a.main.humidity;
            valB = b.main.humidity;
        } else if (columnName === 'wind') {
            valA = a.wind.speed;
            valB = b.wind.speed;
        } else if (columnName === 'rain') { 
            valA = a.rain ? (a.rain['1h'] || 0) : 0;
            valB = b.rain ? (b.rain['1h'] || 0) : 0;
        } else {
            return 0;
        }

        let comparison = 0;

        if (isNumeric) {
            comparison = valA - valB;
        } else {
            if (valA < valB) comparison = -1;
            if (valA > valB) comparison = 1;
        }

        return isAscending ? comparison : comparison * -1;
    });
    
    displayAllWeather();
}

function displayAllWeather() {
    weatherTableBody.innerHTML = ''; 
    allWeatherData.forEach(data => {
        displayWeatherRow(data); 
    });
}


function addSortingListeners() {
    const headers = document.querySelectorAll('#weather-table th');
    
    if (headers.length >= 7) {
        headers[0].addEventListener('click', () => sortTable('name', false));      
        headers[1].addEventListener('click', () => sortTable('temp', true));       
        headers[4].addEventListener('click', () => sortTable('humidity', true));    
        headers[5].addEventListener('click', () => sortTable('wind', true));       
        headers[6].addEventListener('click', () => sortTable('rain', true));       
    }
}


// =========================================================
// 5. INISIALISASI DAN LISTENER (Paling bawah)
// =========================================================

document.getElementById('search-button').addEventListener('click', searchCityWeather);
document.getElementById('show-all-button').addEventListener('click', fetchAllWeather);
document.getElementById('my-location-button').addEventListener('click', getMyLocationWeather); 

document.getElementById('city-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchCityWeather();
    }
});


fetchAllWeather();
