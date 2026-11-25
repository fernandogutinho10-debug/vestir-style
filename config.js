// ============================================================
//  CONFIGURAÇÃO DA VESTIR STYLE
//  Usa o mesmo projeto Firebase da festa (festa-na-casa).
//  Se "apiKey" ficar vazio, o site roda em MODO DEMONSTRAÇÃO.
// ============================================================
window.VS_CONFIG = {
  firebaseConfig: {
  apiKey: "AIzaSyDQR0wsn-L53MJJLoSLr6eh4XPKA-ddM7I",
  authDomain: "festa-na-casa.firebaseapp.com",
  projectId: "festa-na-casa",
  storageBucket: "festa-na-casa.firebasestorage.app",
  messagingSenderId: "743497575335",
  appId: "1:743497575335:web:61d5359c7bb9637bab6482"
},
  ADMIN_EMAIL: "fernando.gutinho10@gmail.com",
  // Valores iniciais: depois você muda tudo pelo painel (#admin)
  defaults: {
    prices: { tshirt: 69.9, hoodie: 169.9 },
    pixKey: "131.911.346-03",
    pixName: "",
    minQty: 10,
    whatsapp: ""
  }
};
