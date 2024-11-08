import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
const s3Client = new S3Client({ region: "ap-southeast-1" });

const client = new DynamoDBClient({});

const dynamo = DynamoDBDocumentClient.from(client);

const offset = 7;

export const handler = async (event) => {

  let body;
  let statusCode = 200;
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST",
    "Content-Type": "application/json",
  };

  let code = 0;
  let meta;
  let data = '';

  try {

    const switchKey = event.httpMethod + " " + event.path;
    const requestBody = JSON.parse(event.body);

    if (event.resource === "/dynamic/user/calculator/{proxy+}") {
      switch (switchKey) {
        case "POST /dynamic/user/calculator/init":
          const bill = numberValidation(requestBody.body.bill);
          if (bill !== null) {
            try {
              const panelSize = await getBillResult(bill)
              if (panelSize !== null) {
                const savingsList = panelSize.map((number, index) => (bill * 100 - number * 100 - (index + offset) * 40 * 0.65 * 100)/100);
                const maxSaving = Math.max(...savingsList);
                const maxIndex = savingsList.indexOf(maxSaving);
                const minBill = panelSize[maxIndex]
                meta = 'ok',
                data = {savingsList: getSubList(savingsList, maxIndex), maxSaving, maxIndex, minBill}
              } else {
                code = 17001
                meta = "Out of Calculation Range"
              }
            } catch (err) {
              code = 17010;
              meta = err.message;
            }
          } else {
            code = 17100;
            meta = "Invalid Input";
          }
          break;

        case "POST /dynamic/user/calculator/update":
          const targetBill = numberValidation(requestBody.body.bill);
          const targetIndex = numberValidation(requestBody.body.index);
          if (targetBill !== null && targetIndex !== null) {
            try {
              const panelSize = await getBillResult(targetBill)
              if (panelSize !== null) {
                const savingsList = panelSize.map((number, index) => (targetBill * 100 - number * 100 - (index + offset) * 40 * 0.65 * 100)/100);
                const maxSaving = savingsList[targetIndex]
                const maxIndex = targetIndex
                const minBill = panelSize[targetIndex]
                meta = 'ok',
                data = {savingsList: getSubList(savingsList, targetIndex), maxSaving, maxIndex, minBill}
              } else {
                code = 17001
                meta = "Out of Calculation Range"
              }
            } catch (err) {
              code = 17010;
              meta = err.message;
            }
          } else {
            code = 17100;
            meta = "Invalid Input";
          }
          break;
      }
    }

  } catch (error) {
    code = 500;
    meta = error;
    data = '';
  }

  body = JSON.stringify({
    code,
    meta,
    data,
  });
  return {
    statusCode: 200,
    headers: headers,
    body: body,
  };
};


function numberValidation(input) {

  if(input === null || input === undefined) {
    return null
  }

  const number = typeof input === 'string' ? Number(input) : input;

  if (!isNaN(number) && number >= 0) {
    return number;
  } else {
    return null;
  }
}

function getSubList(list, index) {
  if (index < 0 || index >= list.length) {
    throw new Error("Out of Index Range");
  }
  if (index === 0) {
    return list.slice(0, 3);
  }
  if (index === list.length - 1) {
    return list.slice(-3);
  }
  return list.slice(index - 1, index + 2);
}

async function getBillResult(bill) {
  const billResult = await dynamo.send(
    new GetCommand({
      TableName: "sunwise_panel_output",
      Key: {
        electricBill: bill,
      },
    })
  );

  if (billResult.Item !== undefined) {
    return billResult.Item.panelSize
  }
  else return null
}
