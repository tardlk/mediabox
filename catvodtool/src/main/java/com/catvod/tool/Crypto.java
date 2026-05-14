package com.catvod.tool;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;

/**
 * Replicates com.catvod.tool.Crypto.
 * MD5, AES, RSA implementations — pure JDK, no Android dependencies.
 */
public class Crypto {

    public static String md5(String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    public static String aes(String mode, boolean encrypt, String input, boolean inBase64,
                             String key, String iv, boolean outBase64) {
        try {
            byte[] keyBuf = key.getBytes(StandardCharsets.UTF_8);
            if (keyBuf.length < 16) keyBuf = Arrays.copyOf(keyBuf, 16);
            byte[] ivBuf = iv == null ? new byte[0] : iv.getBytes(StandardCharsets.UTF_8);
            if (ivBuf.length < 16) ivBuf = Arrays.copyOf(ivBuf, 16);
            Cipher cipher = Cipher.getInstance(mode + "Padding");
            SecretKeySpec keySpec = new SecretKeySpec(keyBuf, "AES");
            if (iv == null) cipher.init(encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, keySpec);
            else cipher.init(encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(ivBuf));
            byte[] inBuf = inBase64 ? Base64.getDecoder().decode(input.replaceAll("_", "/").replaceAll("-", "+"))
                    : input.getBytes(StandardCharsets.UTF_8);
            byte[] out = cipher.doFinal(inBuf);
            return outBase64 ? Base64.getEncoder().encodeToString(out) : new String(out, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    public static String rsa(String mode, boolean pub, boolean encrypt, String input,
                             boolean inBase64, String key, boolean outBase64) {
        try {
            Key rsaKey = generateKey(pub, key);
            String transformation = "RSA/ECB/PKCS1Padding";
            if ("RSA/PKCS1".equals(mode)) transformation = "RSA/ECB/PKCS1Padding";
            else if ("RSA/None/NoPadding".equals(mode)) transformation = "RSA/None/NoPadding";
            byte[] inBytes = inBase64 ? Base64.getDecoder().decode(input.replaceAll("_", "/").replaceAll("-", "+"))
                    : input.getBytes(StandardCharsets.UTF_8);
            Cipher cipher = Cipher.getInstance(transformation);
            cipher.init(encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, rsaKey);
            byte[] out = cipher.doFinal(inBytes);
            return outBase64 ? Base64.getEncoder().encodeToString(out) : new String(out, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static Key generateKey(boolean pub, String key) throws Exception {
        if (pub) key = key.replaceAll("[\\r\\n]", "")
                .replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "");
        else key = key.replaceAll("[\\r\\n]", "")
                .replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "");
        byte[] keyBytes = Base64.getDecoder().decode(key);
        return pub ? KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(keyBytes))
                : KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
    }

    // s2t/t2s delegated to Trans.java
    public static String s2t(String text) { return Trans.s2t(text); }
    public static String t2s(String text) { return Trans.t2s(text); }
}
